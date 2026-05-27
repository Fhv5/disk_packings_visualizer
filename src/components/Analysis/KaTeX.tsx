'use client';
import { useEffect, useRef } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface KaTeXProps {
  math: string;
  displayMode?: boolean;
  className?: string;
}

export function KaTeX({ math, displayMode = false, className = '' }: KaTeXProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    try {
      katex.render(math, containerRef.current, {
        displayMode,
        throwOnError: false,
        trust: true
      });
    } catch (err) {
      containerRef.current.textContent = math;
    }
  }, [math, displayMode]);

  return <span ref={containerRef} className={className} />;
}
