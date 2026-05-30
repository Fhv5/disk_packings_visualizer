'use client';
import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { getBoundingBox, Point2D } from '@/lib/geometry';
import { ParsedCoordinate } from '@/lib/types';

interface ThumbnailCanvasProps {
  centers: [ParsedCoordinate, ParsedCoordinate][];
  contacts: [number, number][];
  width?: number;
  height?: number;
}

export function ThumbnailCanvas({ centers, contacts, width = 200, height = 150 }: ThumbnailCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const theme = useAppStore(state => state.theme);

  useEffect(() => {
    let animId = requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);

      if (centers.length === 0) return;

      const floatPoints = centers.map(([x, y]) => [x.floatValue, y.floatValue]) as Point2D[];
      const box = getBoundingBox(floatPoints);
      let minX = box.minX;
      let minY = box.minY;
      let maxX = box.maxX;
      let maxY = box.maxY;

      minX -= 1;
      minY -= 1;
      maxX += 1;
      maxY += 1;

      const dataWidth = maxX - minX;
      const dataHeight = maxY - minY;

      const padding = 10;
      const availableWidth = width - padding * 2;
      const availableHeight = height - padding * 2;

      const scale = Math.min(availableWidth / dataWidth, availableHeight / dataHeight);
      
      const cx = minX + dataWidth / 2;
      const cy = minY + dataHeight / 2;

      const canvasCx = width / 2;
      const canvasCy = height / 2;

      ctx.save();
      ctx.translate(canvasCx, canvasCy);
      ctx.scale(scale, scale);
      ctx.translate(-cx, -cy);

      const edgeColors = [
        '#06b6d4',
        '#f97316',
        '#22c55e',
        '#ef4444',
        '#a855f7',
        '#b45309',
        '#3b82f6',
        '#ec4899',
        '#14b8a6',
        '#eab308'
      ];
      
      ctx.lineWidth = 2.5 / scale;
      contacts.forEach(([u, v], i) => {
        ctx.beginPath();
        ctx.strokeStyle = edgeColors[i % edgeColors.length];
        const p1 = centers[u];
        const p2 = centers[v];
        if (p1 && p2) {
          ctx.moveTo(p1[0].floatValue, p1[1].floatValue);
          ctx.lineTo(p2[0].floatValue, p2[1].floatValue);
        }
        ctx.stroke();
      });

      const isLight = theme === 'light';
      centers.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x.floatValue, y.floatValue, 1, 0, 2 * Math.PI);
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
        ctx.strokeStyle = isLight ? '#8e8e93' : '#a1a1aa';
        ctx.lineWidth = 1.5 / scale;
        ctx.stroke();
      });

      ctx.restore();
    });

    return () => cancelAnimationFrame(animId);

  }, [centers, contacts, width, height, theme]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height} 
      className="bg-transparent block mx-auto"
    />
  );
}
