"use client";

import { useEffect, useRef, useState } from "react";

// Subtle dither effect - more seamless with content
export function AuthBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });
  const frameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize handler
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    // Bayer 8x8 dither matrix
    const bayerMatrix = [
      [0, 32, 8, 40, 2, 34, 10, 42],
      [48, 16, 56, 24, 50, 18, 58, 26],
      [12, 44, 4, 36, 14, 46, 6, 38],
      [60, 28, 52, 20, 62, 30, 54, 22],
      [3, 35, 11, 43, 1, 33, 9, 41],
      [51, 19, 59, 27, 49, 17, 57, 25],
      [15, 47, 7, 39, 13, 45, 5, 37],
      [63, 31, 55, 23, 61, 29, 53, 21],
    ].map((row) => row.map((v) => v / 64));

    // Noise function (simplified Perlin-like)
    const noise = (x: number, y: number, t: number) => {
      const freq = 2.5; // Lower frequency for smoother waves
      const amp = 0.25; // Lower amplitude for subtler effect
      let value = 0;
      let amplitude = 1;
      let frequency = freq;

      for (let i = 0; i < 3; i++) { // Fewer octaves for smoother look
        value +=
          amplitude *
          Math.abs(
            Math.sin(x * frequency + t * 0.3) * // Slower time
              Math.cos(y * frequency + t * 0.2)
          );
        frequency *= 2;
        amplitude *= amp;
      }
      return value;
    };

    // Animation loop
    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const pixelSize = 4; // Larger pixels = less busy

      ctx.fillStyle = "#050607";
      ctx.fillRect(0, 0, w, h);

      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;

      const time = timeRef.current;
      const mx = mousePos.x;
      const my = mousePos.y;

      for (let y = 0; y < h; y += pixelSize) {
        for (let x = 0; x < w; x += pixelSize) {
          const nx = x / w - 0.5;
          const ny = y / h - 0.5;

          // Wave pattern
          let value = noise(nx, ny, time);

          // Subtle mouse interaction (smaller radius, gentler effect)
          const dx = nx - (mx - 0.5);
          const dy = ny - (my - 0.5);
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 0.15) {
            value += 0.15 * (1 - dist / 0.15); // Gentle brightening instead of darkening
          }

          // Edge fade - darken edges where content is
          // Left edge (0-30% of width)
          const leftFade = Math.min(1, (x / w) / 0.35);
          // Right edge (70-100% of width) 
          const rightFade = Math.min(1, (1 - x / w) / 0.35);
          // Top and bottom
          const topFade = Math.min(1, (y / h) / 0.15);
          const bottomFade = Math.min(1, (1 - y / h) / 0.15);
          
          const edgeFade = leftFade * rightFade * topFade * bottomFade;
          value *= edgeFade * 0.4 + 0.1; // Max 50% intensity, min 10%

          // Dither with reduced contrast
          const bx = Math.floor(x / pixelSize) % 8;
          const by = Math.floor(y / pixelSize) % 8;
          const threshold = bayerMatrix[by][bx];

          // Gentler quantization (more levels = smoother gradients)
          const levels = 6;
          const step = 1 / (levels - 1);
          value += (threshold - 0.5) * step * 0.5; // Reduced dither contrast
          value = Math.max(0, Math.min(1, value));
          const quantized = Math.floor(value * (levels - 1) + 0.5) / (levels - 1);

          // Apply color (cyan #00d4ff) with reduced intensity
          const intensity = quantized * 0.6; // Max 60% color intensity
          const r = Math.floor(intensity * 0);
          const g = Math.floor(intensity * 212);
          const b = Math.floor(intensity * 255);

          // Fill pixel block
          for (let py = 0; py < pixelSize && y + py < h; py++) {
            for (let px = 0; px < pixelSize && x + px < w; px++) {
              const i = ((y + py) * w + (x + px)) * 4;
              data[i] = r;
              data[i + 1] = g;
              data[i + 2] = b;
              data[i + 3] = 255;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);

      timeRef.current += 0.008; // Much slower animation
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, [mousePos]);

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePos({
      x: e.clientX / window.innerWidth,
      y: e.clientY / window.innerHeight,
    });
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0"
      style={{ zIndex: 0 }}
    />
  );
}
