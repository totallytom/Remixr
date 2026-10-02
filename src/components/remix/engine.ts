// Remix Studio audio engine: decode sources, draw peaks, preview the mix live
// and render it offline to MP3. Preview and render share scheduleMix(), so
// what you hear is what gets published.

export const MAX_LAYERS = 4;
export const MAX_REMIX_SEC = 6 * 60;
const RENDER_RATE = 44100;
const MP3_KBPS = 192;
const PEAK_BUCKETS = 2000;

export interface SourceTrack {
  id: string;
  title: string;
  artist: string;
  cover?: string;
  audioUrl: string;
  duration: number;
  licenseType?: string;
  userId?: string;
}

export interface Layer {
  key: string;
  track: SourceTrack;
  status: 'loading' | 'ready' | 'error';
  error?: string;
  buffer?: AudioBuffer;
  /** Max |sample| per bucket over the whole buffer, 0–1. */
  peaks?: Float32Array;
  /** Where the clip starts on the timeline (s). */
  offset: number;
  /** Clip in/out points inside the source (s). */
  trimStart: number;
  trimEnd: number;
  /** 0–1.5 (100% = 1). */
  gain: number;
  fadeIn: number;
  fadeOut: number;
  muted: boolean;
  solo: boolean;
}

export const clipLength = (l: Layer) => Math.max(0, l.trimEnd - l.trimStart);

/** Length of the whole mix (s), capped at MAX_REMIX_SEC. */
export function mixLength(layers: Layer[]): number {
  const end = layers.reduce((m, l) => (l.status === 'ready' ? Math.max(m, l.offset + clipLength(l)) : m), 0);
  return Math.min(end, MAX_REMIX_SEC);
}

export function audibleLayers(layers: Layer[]): Layer[] {
  const anySolo = layers.some((l) => l.solo && l.status === 'ready');
  return layers.filter((l) => l.status === 'ready' && l.buffer && !l.muted && (!anySolo || l.solo));
}

// ─── Decoding ────────────────────────────────────────────────────────────────

let decodeCtx: AudioContext | null = null;
const bufferCache = new Map<string, Promise<AudioBuffer>>();

export function loadBuffer(url: string): Promise<AudioBuffer> {
  const hit = bufferCache.get(url);
  if (hit) return hit;
  const p = (async () => {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) throw new Error(`Couldn't load audio (${res.status})`);
    const data = await res.arrayBuffer();
    decodeCtx ??= new AudioContext();
    return await decodeCtx.decodeAudioData(data);
  })();
  bufferCache.set(url, p);
  p.catch(() => bufferCache.delete(url));
  return p;
}

export function computePeaks(buffer: AudioBuffer, buckets = PEAK_BUCKETS): Float32Array {
  const out = new Float32Array(buckets);
  const chans = Array.from({ length: buffer.numberOfChannels }, (_, c) => buffer.getChannelData(c));
  const per = buffer.length / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = Math.floor(b * per);
    const to = Math.min(buffer.length, Math.floor((b + 1) * per));
    const step = Math.max(1, Math.floor((to - from) / 64)); // sample, don't scan every frame
    let max = 0;
    for (const ch of chans) {
      for (let i = from; i < to; i += step) {
        const v = Math.abs(ch[i]);
        if (v > max) max = v;
      }
    }
    out[b] = Math.min(1, max);
  }
  return out;
}

// ─── Scheduling (shared by preview and render) ───────────────────────────────

/** Gain at local clip time u (0…len). */
function envelopeAt(l: Layer, u: number): number {
  const len = clipLength(l);
  const fi = Math.min(l.fadeIn, len / 2);
  const fo = Math.min(l.fadeOut, len / 2);
  let g = l.gain;
  if (fi > 0 && u < fi) g *= u / fi;
  if (fo > 0 && u > len - fo) g *= Math.max(0, (len - u) / fo);
  return g;
}

/** Master bus: a gentle limiter so stacked layers don't clip. */
function masterBus(ctx: BaseAudioContext): AudioNode {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -3;
  comp.knee.value = 0;
  comp.ratio.value = 20;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  comp.connect(ctx.destination);
  return comp;
}

/**
 * Schedule every audible layer on ctx, starting the mix at `from` seconds,
 * with mix time `from` landing at ctx time `when`. Returns the sources.
 */
export function scheduleMix(ctx: BaseAudioContext, layers: Layer[], from: number, when: number): AudioBufferSourceNode[] {
  const bus = masterBus(ctx);
  const end = mixLength(layers);
  const nodes: AudioBufferSourceNode[] = [];
  for (const l of audibleLayers(layers)) {
    const len = clipLength(l);
    const clipEnd = Math.min(l.offset + len, end);
    if (from >= clipEnd || len <= 0) continue;
    const u0 = Math.max(0, from - l.offset);              // local time we start at
    const startAt = when + Math.max(0, l.offset - from);  // ctx time
    const playFor = clipEnd - (l.offset + u0);

    const src = ctx.createBufferSource();
    src.buffer = l.buffer!;
    const g = ctx.createGain();
    src.connect(g).connect(bus);

    // Fade envelope from u0 onwards.
    const fi = Math.min(l.fadeIn, len / 2);
    const fo = Math.min(l.fadeOut, len / 2);
    g.gain.setValueAtTime(envelopeAt(l, u0), startAt);
    if (fi > 0 && u0 < fi) g.gain.linearRampToValueAtTime(l.gain, startAt + (fi - u0));
    if (fo > 0) {
      const foStart = len - fo;
      if (u0 < foStart) g.gain.setValueAtTime(envelopeAt(l, foStart), startAt + (foStart - u0));
      g.gain.linearRampToValueAtTime(0, startAt + (len - u0));
    }

    src.start(startAt, l.trimStart + u0, playFor);
    nodes.push(src);
  }
  return nodes;
}

// ─── Live preview ────────────────────────────────────────────────────────────

export class MixPlayer {
  private ctx: AudioContext | null = null;
  private nodes: AudioBufferSourceNode[] = [];
  private startedAt = 0;   // ctx time when mix position `startPos` played
  private startPos = 0;
  playing = false;

  position(): number {
    if (!this.playing || !this.ctx) return this.startPos;
    return this.startPos + (this.ctx.currentTime - this.startedAt);
  }

  async play(layers: Layer[], from: number) {
    this.stopNodes();
    this.ctx ??= new AudioContext();
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const when = this.ctx.currentTime + 0.05;
    this.nodes = scheduleMix(this.ctx, layers, from, when);
    this.startedAt = when;
    this.startPos = from;
    this.playing = true;
  }

  pause() {
    this.startPos = this.position();
    this.stopNodes();
    this.playing = false;
  }

  seek(pos: number) {
    this.startPos = pos;
  }

  private stopNodes() {
    for (const n of this.nodes) {
      try { n.stop(); } catch { /* already stopped */ }
      n.disconnect();
    }
    this.nodes = [];
  }

  dispose() {
    this.stopNodes();
    this.playing = false;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}

// ─── Render + encode ─────────────────────────────────────────────────────────

export async function renderMix(layers: Layer[]): Promise<AudioBuffer> {
  const len = mixLength(layers);
  if (len <= 0) throw new Error('Nothing to render — add a track first.');
  const ctx = new OfflineAudioContext(2, Math.ceil(len * RENDER_RATE), RENDER_RATE);
  scheduleMix(ctx, layers, 0, 0);
  return ctx.startRendering();
}

function toInt16(f: Float32Array, from: number, to: number): Int16Array {
  const out = new Int16Array(to - from);
  for (let i = from; i < to; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i - from] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Encode to MP3 in chunks, yielding so the UI can show progress. */
export async function encodeMp3(buffer: AudioBuffer, onProgress?: (p: number) => void): Promise<Blob> {
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const enc = new Mp3Encoder(2, buffer.sampleRate, MP3_KBPS);
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const CHUNK = 1152 * 64;
  const parts: Uint8Array[] = [];
  for (let i = 0; i < buffer.length; i += CHUNK) {
    const to = Math.min(buffer.length, i + CHUNK);
    const out = enc.encodeBuffer(toInt16(left, i, to), toInt16(right, i, to));
    if (out.length) parts.push(out);
    if ((i / CHUNK) % 8 === 0) {
      onProgress?.(i / buffer.length);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const tail = enc.flush();
  if (tail.length) parts.push(tail);
  onProgress?.(1);
  return new Blob(parts as BlobPart[], { type: 'audio/mpeg' });
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
}
