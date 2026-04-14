/**
 * Client-side WAV/AIFF → M4A (AAC) transcoding for uploads.
 * Reduces storage use on Supabase (e.g. GarageBand exports from iOS).
 * Uses ffmpeg.wasm; load runs once and is reused.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const INPUT_NAME = 'input_upload';
const OUTPUT_NAME = 'output.m4a';
const AAC_BITRATE = '128k';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<void> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) {
    await loadPromise;
    return ffmpegInstance!;
  }
  loadPromise = (async () => {
    const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
    ffmpegInstance = ffmpeg;
  })();
  await loadPromise;
  return ffmpegInstance!;
}

/**
 * Whether the file is a format we transcode to M4A (WAV or AIFF).
 */
export function shouldTranscodeToM4a(file: File): boolean {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  return (
    ext === 'wav' ||
    ext === 'aiff' ||
    ext === 'aif' ||
    type === 'audio/wav' ||
    type === 'audio/wave' ||
    type === 'audio/x-wav' ||
    type === 'audio/aiff' ||
    type === 'audio/x-aiff'
  );
}

/**
 * Transcode a WAV or AIFF file to M4A (AAC) in the browser.
 * Returns a new File with the same base name and .m4a extension.
 * @throws Error if FFmpeg load or transcode fails
 */
export async function transcodeWavOrAiffToM4a(file: File): Promise<File> {
  if (!shouldTranscodeToM4a(file)) {
    return file;
  }
  const ffmpeg = await getFFmpeg();
  const inputExt = (file.name.split('.').pop() || 'wav').toLowerCase();
  const inputPath = `${INPUT_NAME}.${inputExt === 'aif' ? 'aiff' : inputExt}`;

  const data = new Uint8Array(await file.arrayBuffer());
  ffmpeg.writeFile(inputPath, data);

  await ffmpeg.exec([
    '-i', inputPath,
    '-c:a', 'aac',
    '-b:a', AAC_BITRATE,
    '-y',
    OUTPUT_NAME,
  ]);

  const outputData = await ffmpeg.readFile(OUTPUT_NAME);
  ffmpeg.deleteFile(inputPath);
  ffmpeg.deleteFile(OUTPUT_NAME);

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const m4aName = `${baseName}.m4a`;
  const blob = new Blob([outputData], { type: 'audio/mp4' });
  return new File([blob], m4aName, { type: 'audio/mp4' });
}
