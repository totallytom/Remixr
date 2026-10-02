import React, { useEffect, useRef } from 'react';

interface AudioBarsProps {
  getAnalyser: () => AnalyserNode | null;
  active: boolean;
  bars?: number;
  className?: string;
  color?: string;
}

/**
 * Live frequency bars for the playing preview. Falls back to a soft idle
 * animation when the browser can't analyse the audio.
 */
const AudioBars: React.FC<AudioBarsProps> = ({ getAnalyser, active, bars = 24, className = '', color = '#000' }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const data = new Uint8Array(32);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth * dpr;
      const h = canvas.clientHeight * dpr;
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      ctx.clearRect(0, 0, w, h);

      const analyser = active ? getAnalyser() : null;
      if (analyser) analyser.getByteFrequencyData(data);

      const gap = 3 * dpr;
      const bw = (w - gap * (bars - 1)) / bars;
      ctx.fillStyle = color;
      for (let i = 0; i < bars; i++) {
        let v: number;
        if (analyser) {
          v = data[Math.floor((i / bars) * data.length * 0.85)] / 255;
        } else if (active && !reduceMotion) {
          v = 0.25 + 0.25 * Math.sin(t / 180 + i * 0.6) * Math.sin(t / 420 + i);
          v = Math.abs(v) + 0.1;
        } else {
          v = 0.06;
        }
        const bh = Math.max(2 * dpr, v * h);
        const x = i * (bw + gap);
        ctx.fillRect(x, h - bh, bw, bh);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [getAnalyser, active, bars, color]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};

export default AudioBars;
