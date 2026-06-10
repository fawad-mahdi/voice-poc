import React, { useEffect, useRef } from "react";

/** Broadcast-style segmented level meter for the operator's microphone. */
export default function MicMeter({ stream }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!stream || !canvasRef.current) return;

    const ctx2d = canvasRef.current.getContext("2d");
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    const SEGMENTS = 18;
    const dpr = window.devicePixelRatio || 1;
    const W = canvasRef.current.clientWidth || 200;
    const H = canvasRef.current.clientHeight || 18;
    canvasRef.current.width = W * dpr;
    canvasRef.current.height = H * dpr;
    ctx2d.scale(dpr, dpr);
    const segW = W / SEGMENTS;
    let raf;

    const draw = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);
      const level = Math.min(1, rms * 4);
      const lit = Math.round(level * SEGMENTS);

      ctx2d.clearRect(0, 0, W, H);
      for (let i = 0; i < SEGMENTS; i++) {
        const on = i < lit;
        const hot = i >= SEGMENTS - 4;
        ctx2d.fillStyle = on ? (hot ? "#F8552F" : "#0E7A57") : "rgba(14,122,87,0.13)";
        const r = 2;
        const x = i * segW + 1;
        const w = segW - 3;
        ctx2d.beginPath();
        ctx2d.roundRect(x, 2, w, H - 4, r);
        ctx2d.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      source.disconnect();
      audioCtx.close().catch(() => {});
    };
  }, [stream]);

  return <canvas ref={canvasRef} className="mic-meter" aria-label="Microphone level" />;
}
