'use client';
import { useMemo } from 'react';
import { KaTeX } from './KaTeX';
import { toSymbolicLaTeX } from './MatrixDisplay';
import { useAppStore } from '@/lib/store';

interface EigenvalueDisplayProps {
  eigenvalues: number[];
  isLocalMinimum: boolean;
}

export function EigenvalueDisplay({
  eigenvalues,
  isLocalMinimum,
}: EigenvalueDisplayProps) {
  const theme = useAppStore(state => state.theme);
  const isLight = theme === 'light';

  const latexVector = useMemo(() => {
    if (eigenvalues.length === 0) return '\\mu(c) = \\varnothing';
    const body = eigenvalues.map((v) => {
      const sym = toSymbolicLaTeX(v);
      return sym !== null ? sym : v.toFixed(6);
    }).join(' \\\\[0.3em] ');
    return `\\mu(c) = \\begin{pmatrix} ${body} \\end{pmatrix}`;
  }, [eigenvalues]);

  if (eigenvalues.length === 0) {
    return (
      <div className={`flex flex-col gap-2 p-3 rounded-md border ${
        isLight ? 'bg-zinc-50 border-zinc-100' : 'bg-zinc-900/40 border-zinc-800'
      }`}>
        <p className={`text-xs ${isLight ? 'text-zinc-400' : 'text-zinc-500'} italic`}>No eigenvalues (rolling space dimension is 0)</p>
        <div className="flex gap-2 items-center mt-1">
          <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${isLight ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-950/40 text-emerald-400'}`}>
            Local Minimum
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 w-full">
      <div className={`overflow-x-auto max-w-full custom-scrollbar border rounded-lg p-3 flex justify-center ${
        isLight ? 'border-zinc-100 bg-zinc-50/10' : 'border-zinc-800/80 bg-zinc-900/5'
      }`}>
        <div className={isLight ? 'text-zinc-800' : 'text-zinc-200'}>
          <KaTeX math={latexVector} displayMode={true} />
        </div>
      </div>
      <div className="flex flex-col gap-3 w-full">
        <div className="flex flex-wrap gap-1.5">
          {eigenvalues.map((v, i) => {
            let colorClass = isLight 
              ? 'bg-zinc-50 text-zinc-700 border-zinc-200' 
              : 'bg-zinc-900/40 text-zinc-300 border-zinc-800';
            if (v < -1e-6) {
              colorClass = isLight 
                ? 'bg-red-50 text-red-700 border-red-200' 
                : 'bg-red-950/20 text-red-400 border-red-900/30';
            } else if (v > 1e-6) {
              colorClass = isLight 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30';
            }
            const symV = toSymbolicLaTeX(v);
            return (
              <span key={i} className={`text-[11px] font-mono px-2 py-1 rounded border flex items-center gap-1.5 ${colorClass}`}>
                <span className="text-[9px] opacity-60">λ_{i}:</span>
                {symV !== null ? (
                  <KaTeX math={symV} className="font-semibold text-xs text-inherit" />
                ) : (
                  <strong className="font-semibold">{v.toFixed(6)}</strong>
                )}
              </span>
            );
          })}
        </div>
        <div className="flex gap-2 items-center mt-1">
          {isLocalMinimum ? (
            <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
              Local Minimum
            </span>
          ) : (
            <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-red-500/10 text-red-500 border border-red-500/25">
              Saddle / Maximum
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
