'use client';
import { useMemo } from 'react';
import { KaTeX } from './KaTeX';
import { useAppStore } from '@/lib/store';

interface MatrixDisplayProps {
  matrix: number[][];
  label?: string; // Optional prefix label, e.g. "A" or "H_P"
}

export function toSymbolicLaTeX(val: number): string | null {
  const tol = 1e-6;

  if (Math.abs(val) < tol) return '0';
  if (Math.abs(val - 1) < tol) return '1';
  if (Math.abs(val + 1) < tol) return '-1';
  if (Math.abs(val - 2) < tol) return '2';
  if (Math.abs(val + 2) < tol) return '-2';
  if (Math.abs(val - 3) < tol) return '3';
  if (Math.abs(val + 3) < tol) return '-3';
  if (Math.abs(val - 0.5) < tol) return '\\frac{1}{2}';
  if (Math.abs(val + 0.5) < tol) return '-\\frac{1}{2}';
  if (Math.abs(val - Math.sqrt(3) / 2) < tol) return '\\frac{\\sqrt{3}}{2}';
  if (Math.abs(val + Math.sqrt(3) / 2) < tol) return '-\\frac{\\sqrt{3}}{2}';
  if (Math.abs(val - Math.sqrt(2) / 2) < tol) return '\\frac{\\sqrt{2}}{2}';
  if (Math.abs(val + Math.sqrt(2) / 2) < tol) return '-\\frac{\\sqrt{2}}{2}';
  if (Math.abs(val - Math.sqrt(3)) < tol) return '\\sqrt{3}';
  if (Math.abs(val + Math.sqrt(3)) < tol) return '-\\sqrt{3}';
  if (Math.abs(val - 1 / 3) < tol) return '\\frac{1}{3}';
  if (Math.abs(val + 1 / 3) < tol) return '-\\frac{1}{3}';
  if (Math.abs(val - 2 / 3) < tol) return '\\frac{2}{3}';
  if (Math.abs(val + 2 / 3) < tol) return '-\\frac{2}{3}';
  if (Math.abs(val - 1.5) < tol) return '\\frac{3}{2}';
  if (Math.abs(val + 1.5) < tol) return '-\\frac{3}{2}';
  if (Math.abs(val - 1 / Math.sqrt(3)) < tol) return '\\frac{\\sqrt{3}}{3}';
  if (Math.abs(val + 1 / Math.sqrt(3)) < tol) return '-\\frac{\\sqrt{3}}{3}';
  if (Math.abs(val - 2 / Math.sqrt(3)) < tol) return '\\frac{2\\sqrt{3}}{3}';
  if (Math.abs(val + 2 / Math.sqrt(3)) < tol) return '-\\frac{2\\sqrt{3}}{3}';

  return null;
}

function toLatexFraction(val: number): string {
  const sym = toSymbolicLaTeX(val);
  if (sym !== null) return sym;

  // Fall back to decimal with clean zeros
  const s = val.toFixed(4).replace(/\.?0+$/, '');
  return s;
}

export function MatrixDisplay({ matrix, label }: MatrixDisplayProps) {
  const theme = useAppStore(state => state.theme);
  const isLight = theme === 'light';

  const latex = useMemo(() => {
    if (!matrix || matrix.length === 0 || matrix[0].length === 0) return '';
    const rows = matrix.map((row) =>
      row.map((val) => toLatexFraction(val)).join(' & ')
    );
    const matBody = rows.join(' \\\\ ');
    const prefix = label ? `${label} = ` : '';
    return `${prefix}\\begin{pmatrix} ${matBody} \\end{pmatrix}`;
  }, [matrix, label]);

  if (!matrix || matrix.length === 0 || matrix[0].length === 0) {
    return <p className="text-xs text-zinc-500 italic">Empty matrix</p>;
  }

  return (
    <div className="flex flex-col gap-1 overflow-x-auto py-2 my-1 max-w-full custom-scrollbar">
      <div className={`min-w-max text-sm ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
        <KaTeX math={latex} displayMode={true} />
      </div>
      <p className={`text-[10px] ${isLight ? 'text-zinc-400' : 'text-zinc-500'} font-mono mt-1 select-none`}>
        Dimension: {matrix.length} × {matrix[0].length}
      </p>
    </div>
  );
}

