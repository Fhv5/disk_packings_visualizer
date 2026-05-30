'use client';
import { useMemo, useState, useEffect } from 'react';
import { AnalysisResult } from '@/lib/analysis/types';
import { CollapsibleSection } from './CollapsibleSection';
import { MatrixDisplay, toSymbolicLaTeX } from './MatrixDisplay';
import { EigenvalueDisplay } from './EigenvalueDisplay';
import { KaTeX } from './KaTeX';
import { convexHull, getSymbolicPerimeter, Point2D } from '@/lib/geometry';
import { useAppStore } from '@/lib/store';

interface AnalysisPanelProps {
  result: AnalysisResult | null;
  loading: boolean;
  error: string | null;
}

export function AnalysisPanel({ result, loading, error }: AnalysisPanelProps) {
  const [showSymbolicCenters, setShowSymbolicCenters] = useState(true);
  const [showSymbolicDisks, setShowSymbolicDisks] = useState(true);
  const theme = useAppStore(state => state.theme);
  const isLight = theme === 'light';

  const criticalityTolerance = useAppStore(state => state.criticalityTolerance);
  const setCriticalityTolerance = useAppStore(state => state.setCriticalityTolerance);
  const [toleranceInput, setToleranceInput] = useState(criticalityTolerance.toExponential());

  useEffect(() => {
    setToleranceInput(criticalityTolerance.toExponential());
  }, [criticalityTolerance]);

  const hull = useMemo(() => {
    if (!result) return [];
    return convexHull(result.configuration.positions as Point2D[]);
  }, [result]);

  const symbolicPerimeterDisks = useMemo(() => {
    return getSymbolicPerimeter(hull);
  }, [hull]);

  const symbolicPerimeterCenters = useMemo(() => {
    const sym = getSymbolicPerimeter(hull);
    if (!sym) return null;
    if (sym === '2π') return '0';
    return sym.replace(' + 2π', '');
  }, [hull]);

  const formatValueSymbolic = (val: number, fallbackPrecision: number = 8) => {
    const sym = toSymbolicLaTeX(val);
    if (sym !== null) {
      return <KaTeX math={sym} className={`${isLight ? 'text-zinc-800' : 'text-zinc-200'} select-all`} />;
    }
    return <span className="select-all font-mono">{val.toFixed(fallbackPrecision)}</span>;
  };

  const gradientLatex = useMemo(() => {
    if (!result) return '';
    const body = result.perimeter.gradient.map(v => {
      const sym = toSymbolicLaTeX(v);
      return sym !== null ? sym : v.toFixed(4);
    }).join(' \\\\[0.3em] ');
    return `\\nabla P = \\begin{pmatrix} ${body} \\end{pmatrix}`;
  }, [result]);

  const projGradientLatex = useMemo(() => {
    if (!result) return '';
    if (result.projectedGradient.length === 0) return 'Z^T \\nabla P = \\varnothing';
    const body = result.projectedGradient.map(v => {
      const sym = toSymbolicLaTeX(v);
      return sym !== null ? sym : v.toFixed(6);
    }).join(' \\\\[0.3em] ');
    return `Z^T \\nabla P = \\begin{pmatrix} ${body} \\end{pmatrix}`;
  }, [result]);

  const lambdasLatex = useMemo(() => {
    if (!result || result.hessian.lagrangeMultipliers.length === 0) return '';
    const body = result.hessian.lagrangeMultipliers.map(v => {
      const sym = toSymbolicLaTeX(v);
      return sym !== null ? sym : v.toFixed(4);
    }).join(' \\\\[0.3em] ');
    return `\\vec{\\lambda} = \\begin{pmatrix} ${body} \\end{pmatrix}`;
  }, [result]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-sm text-zinc-500">
        <svg className={`animate-spin -ml-1 mr-3 h-5 w-5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'} mb-2`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Recomputing analysis...
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-4 rounded-lg text-xs border ${isLight ? 'bg-red-50 text-red-700 border-red-200' : 'bg-red-950/20 text-red-400 border-red-900/40'}`}>
        <h4 className="font-bold mb-1">Analysis Error</h4>
        <p>{error}</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className={`p-4 text-center text-xs ${isLight ? 'text-zinc-400' : 'text-zinc-500'} italic`}>
        Select a configuration to show analysis.
      </div>
    );
  }

  const { configuration, graphValidation, constraints, perimeter, hessian, isCritical } = result;

  return (
    <div className={`flex flex-col gap-4 ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>
      
      {/* Badges Overview Dashboard */}
      <div className="grid grid-cols-3 gap-2 mb-2 select-none">
        <div className={`border rounded-lg p-2.5 text-center flex flex-col justify-center ${isLight ? 'border-zinc-200 bg-zinc-50/50' : 'border-zinc-800/80 bg-zinc-900/40'}`}>
          <span className={`text-[9px] font-bold ${isLight ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-wider block mb-0.5`}>Criticality</span>
          <span className={`text-xs font-bold ${isCritical ? 'text-emerald-500' : 'text-amber-500'}`}>
            {isCritical ? 'CRITICAL' : 'NON-CRITICAL'}
          </span>
        </div>
        <div className={`border rounded-lg p-2.5 text-center flex flex-col justify-center ${isLight ? 'border-zinc-200 bg-zinc-50/50' : 'border-zinc-800/80 bg-zinc-900/40'}`}>
          <span className={`text-[9px] font-bold ${isLight ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-wider block mb-0.5`}>Rigidity</span>
          <span className={`text-xs font-bold ${constraints.dimension <= 3 ? 'text-emerald-500' : 'text-blue-500'}`}>
            {constraints.dimension <= 3 ? 'RIGID' : 'FLEXIBLE'}
          </span>
        </div>
        <div className={`border rounded-lg p-2.5 text-center flex flex-col justify-center ${isLight ? 'border-zinc-200 bg-zinc-50/50' : 'border-zinc-800/80 bg-zinc-900/40'}`}>
          <span className={`text-[9px] font-bold ${isLight ? 'text-zinc-400' : 'text-zinc-500'} uppercase tracking-wider block mb-0.5`}>DOF / Kernel Dim</span>
          <span className={`text-xs font-bold font-mono ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
            {configuration.n * 2 - configuration.contacts.length - 3} / {constraints.dimension}
          </span>
        </div>
      </div>

      {/* Section 1: General Parameters */}
      <CollapsibleSection title="General Configuration Parameters" defaultOpen={true}>
        <div className="grid grid-cols-2 gap-4 text-xs font-medium">
          <div className="space-y-1.5">
            <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-zinc-100' : 'border-zinc-800/60'}`}>
              <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Number of Disks (n)</span>
              <span className="font-mono font-bold">{configuration.n}</span>
            </div>
            <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-zinc-100' : 'border-zinc-800/60'}`}>
              <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Active Contacts (m)</span>
              <span className="font-mono font-bold">{configuration.contacts.length}</span>
            </div>
            <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-zinc-100' : 'border-zinc-800/60'}`}>
              <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Degrees of Freedom</span>
              <span className="font-mono font-bold">{configuration.n * 2 - configuration.contacts.length - 3}</span>
            </div>
            <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-zinc-100' : 'border-zinc-800/60'}`}>
              <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Rolling Dimension</span>
              <span className="font-mono font-bold">{constraints.dimension}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-zinc-100' : 'border-zinc-800/60'}`}>
              <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Perimeter (centers)</span>
              <span 
                className={`font-mono font-bold ${symbolicPerimeterCenters ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                onClick={() => symbolicPerimeterCenters && setShowSymbolicCenters(!showSymbolicCenters)}
                title={symbolicPerimeterCenters ? "Click to toggle exact/decimal" : ""}
              >
                {showSymbolicCenters && symbolicPerimeterCenters ? symbolicPerimeterCenters : result.perimeterCenters.toFixed(6)}
              </span>
            </div>
            <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-zinc-100' : 'border-zinc-800/60'}`}>
              <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Perimeter (disks)</span>
              <span 
                className={`font-mono font-bold ${symbolicPerimeterDisks ? 'cursor-pointer hover:opacity-75 transition-opacity' : ''}`}
                onClick={() => symbolicPerimeterDisks && setShowSymbolicDisks(!showSymbolicDisks)}
                title={symbolicPerimeterDisks ? "Click to toggle exact/decimal" : ""}
              >
                {showSymbolicDisks && symbolicPerimeterDisks ? symbolicPerimeterDisks : perimeter.perimeter.toFixed(6)}
              </span>
            </div>
            <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-zinc-100' : 'border-zinc-800/60'}`}>
              <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Hull Vertices Count</span>
              <span className="font-mono font-bold">{hull.length}</span>
            </div>
            <div className={`flex justify-between border-b pb-1 ${isLight ? 'border-zinc-100' : 'border-zinc-800/60'}`}>
              <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Graph Connection</span>
              <span className={`font-bold ${graphValidation.isValid ? 'text-emerald-500' : 'text-red-500'}`}>
                {graphValidation.isValid ? 'VALID' : 'INVALID'}
              </span>
            </div>
          </div>
          {graphValidation.message && (
            <div className={`col-span-2 text-[10px] border-t pt-1.5 ${isLight ? 'text-zinc-400 border-zinc-100' : 'text-zinc-500 border-zinc-800/60'}`}>
              Graph Status: {graphValidation.message}
            </div>
          )}

          {/* Tolerance control */}
          <div className={`col-span-2 flex justify-between items-center border-t pt-2 mt-1.5 ${
            isLight ? 'border-zinc-100' : 'border-zinc-800/60'
          }`}>
            <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Criticality Tolerance</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  const exponent = Math.round(Math.log10(criticalityTolerance));
                  const nextExponent = Math.max(-15, exponent - 1);
                  setCriticalityTolerance(Math.pow(10, nextExponent));
                }}
                disabled={criticalityTolerance <= 1e-15}
                className={`w-5 h-5 rounded flex items-center justify-center border font-bold text-xs select-none cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
                title="Stricter Tolerance (decrease by 10x)"
              >
                -
              </button>
              <input
                type="text"
                value={toleranceInput}
                onChange={(e) => setToleranceInput(e.target.value)}
                onBlur={() => {
                  const val = parseFloat(toleranceInput);
                  if (!isNaN(val) && val > 0 && val <= 1.0) {
                    setCriticalityTolerance(val);
                    setToleranceInput(val.toExponential());
                  } else {
                    setToleranceInput(criticalityTolerance.toExponential());
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className={`text-xs font-mono font-bold w-20 text-center bg-transparent border-b border-dashed border-zinc-400 focus:border-solid focus:border-amber-500 focus:outline-none focus:ring-0 px-0.5 py-0 ${
                  isLight ? 'text-zinc-700' : 'text-zinc-300'
                }`}
                title="Criticality tolerance threshold (e.g., 1e-6). Click to edit."
              />
              <button
                onClick={() => {
                  const exponent = Math.round(Math.log10(criticalityTolerance));
                  const nextExponent = Math.min(0, exponent + 1);
                  setCriticalityTolerance(Math.pow(10, nextExponent));
                }}
                disabled={criticalityTolerance >= 1.0}
                className={`w-5 h-5 rounded flex items-center justify-center border font-bold text-xs select-none cursor-pointer transition-colors ${
                  isLight
                    ? 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
                }`}
                title="Looser Tolerance (increase by 10x)"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 2: Disk Coordinates */}
      <CollapsibleSection title="Disk Coordinates">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className={`border-b ${isLight ? 'border-zinc-200 text-zinc-400' : 'border-zinc-800 text-zinc-500'} text-[10px] uppercase font-bold whitespace-nowrap`}>
                <th className="py-1.5 pr-2">Index</th>
                <th className="py-1.5 px-2">X Position</th>
                <th className="py-1.5 px-2">Y Position</th>
                <th className="py-1.5 pl-2 text-right">Radius</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${isLight ? 'divide-zinc-100' : 'divide-zinc-800/50'} font-mono font-medium whitespace-nowrap`}>
              {configuration.positions.map(([x, y], idx) => (
                <tr key={idx} className={isLight ? 'hover:bg-zinc-50/50' : 'hover:bg-zinc-900/30'}>
                  <td className={`py-2 pr-2 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>Disk {idx}</td>
                  <td className={`py-2 px-2 ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{formatValueSymbolic(x, 8)}</td>
                  <td className={`py-2 px-2 ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>{formatValueSymbolic(y, 8)}</td>
                  <td className={`py-2 pl-2 text-right ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>{configuration.radii[idx]?.toFixed(1) || '1.0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      {/* Section 3: Contact Jacobian A */}
      <CollapsibleSection title="Contact Matrix A">
        <MatrixDisplay matrix={constraints.contactMatrix} label="A" />
      </CollapsibleSection>

      {/* Section 4: Rolling Space Basis Z = ker(A) */}
      <CollapsibleSection 
        title={
          <div className={`flex items-center gap-1.5 font-bold tracking-wide uppercase text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
            <span>Kernel Basis</span>
            <span className="normal-case">
              <KaTeX math="Z = \text{Roll}(c)" className="text-[11px]" />
            </span>
          </div>
        }
      >
        {constraints.dimension === 0 ? (
          <div className={`p-3 rounded border text-xs italic text-center ${isLight ? 'bg-zinc-50 border-zinc-100 text-zinc-400' : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'}`}>
            Orthonormal kernel is empty. The packing is fully rigid.
          </div>
        ) : (
          <MatrixDisplay matrix={constraints.rollingMatrix} label="Z" />
        )}
      </CollapsibleSection>

      {/* Section 5: Perimeter Gradient */}
      <CollapsibleSection 
        title={
          <div className={`flex items-center gap-1.5 font-bold tracking-wide uppercase text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
            <span>Perimeter Gradient</span>
            <span className="normal-case">
              <KaTeX math="\nabla P" className="text-[11px]" />
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-3.5 w-full">
          <div className={`text-xs leading-relaxed w-full ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            <div className={`grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-1.5 font-mono text-[11px] border rounded-lg p-2.5 ${isLight ? 'border-zinc-100 bg-zinc-50/20' : 'border-zinc-800/80 bg-zinc-900/10'}`}>
              {configuration.positions.map((_, i) => {
                const gx = perimeter.gradient[2 * i] || 0;
                const gy = perimeter.gradient[2 * i + 1] || 0;

                const symX = toSymbolicLaTeX(gx);
                const symY = toSymbolicLaTeX(gy);

                return (
                  <div key={i} className="flex justify-between items-center">
                    <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Disk {i}:</span>
                    <KaTeX 
                      math={`\\left(${symX !== null ? symX : gx.toFixed(4)}, ${symY !== null ? symY : gy.toFixed(4)}\\right)`} 
                      className={`font-semibold text-[11px] ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`} 
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className={`overflow-x-auto max-w-full custom-scrollbar border rounded-lg p-3 flex justify-center ${isLight ? 'border-zinc-100 bg-zinc-50/10' : 'border-zinc-800/80 bg-zinc-900/5'}`}>
            <div className={isLight ? 'text-zinc-800' : 'text-zinc-200'}>
              <KaTeX math={gradientLatex} displayMode={true} />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 6: Projected Gradient */}
      <CollapsibleSection 
        title={
          <div className={`flex items-center gap-1.5 font-bold tracking-wide uppercase text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
            <span>Gradient Projection</span>
            <span className="normal-case">
              <KaTeX math="Z^T \nabla P" className="text-[11px]" />
            </span>
          </div>
        }
      >
        <div className="flex flex-col gap-3.5 w-full">
          <div className={`text-xs leading-relaxed w-full ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-wider border ${
                isCritical 
                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25' 
                  : 'bg-amber-500/10 text-amber-500 border-amber-500/25'
              }`}>
                {isCritical ? 'Critical Point' : 'Non-Critical'}
              </span>
            </div>
            {constraints.dimension > 0 && (
              <div className={`grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-4 gap-y-1.5 font-mono text-[11px] border rounded-lg p-2.5 mt-3 ${isLight ? 'border-zinc-100 bg-zinc-50/20' : 'border-zinc-800/80 bg-zinc-900/10'}`}>
                {result.projectedGradient.map((v, idx) => (
                  <div key={idx} className="flex justify-between items-center">
                    <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>Component {idx}:</span>
                    <span className={`font-semibold ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{formatValueSymbolic(v, 8)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className={`overflow-x-auto max-w-full custom-scrollbar border rounded-lg p-3 flex justify-center ${isLight ? 'border-zinc-100 bg-zinc-50/10' : 'border-zinc-800/80 bg-zinc-900/5'}`}>
            <div className={isLight ? 'text-zinc-800' : 'text-zinc-200'}>
              <KaTeX math={projGradientLatex} displayMode={true} />
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* Section 7: Hessians and Lagrange Multipliers */}
      <CollapsibleSection title="Hessian Matrices & Multipliers">
        {/* Subsection 7.1: Lagrange Multipliers */}
        <div className="pt-1">
          <div className={`flex items-center gap-1.5 mb-2 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            <span>Lagrange Multipliers</span>
            <span className="normal-case font-normal select-all">
              <KaTeX math="\vec{\lambda}" className="text-[11px]" />
            </span>
          </div>
          <div className="flex flex-col gap-3.5 w-full">
            {configuration.contacts.length === 0 ? (
              <p className={`text-xs italic ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>No multiplier vector</p>
            ) : (
              <>
                <div className={`text-[11px] font-mono border rounded-lg p-2.5 w-full ${isLight ? 'border-zinc-100 bg-zinc-50/20' : 'border-zinc-800/80 bg-zinc-900/10'}`}>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-x-6 gap-y-1.5">
                    {configuration.contacts.map(([u, v], idx) => {
                      const lam = hessian.lagrangeMultipliers[idx] || 0;
                      return (
                        <div key={idx} className="flex justify-between items-center">
                          <span className={isLight ? 'text-zinc-400' : 'text-zinc-500'}>C{idx} ({u} - {v}):</span>
                          <span className={`font-semibold ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>{formatValueSymbolic(lam, 6)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className={`overflow-x-auto max-w-full custom-scrollbar border rounded-lg p-3 flex justify-center ${isLight ? 'border-zinc-100 bg-zinc-50/10' : 'border-zinc-800/80 bg-zinc-900/5'}`}>
                  <div className={isLight ? 'text-zinc-800' : 'text-zinc-200'}>
                    <KaTeX math={lambdasLatex} displayMode={true} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Subsection 7.2: Euclidean Hessian */}
        <div className={`border-t pt-4 mt-4 ${isLight ? 'border-zinc-100' : 'border-zinc-800/80'}`}>
          <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            <span>Euclidean Hessian</span>
            <span className="normal-case font-normal select-all">
              <KaTeX math="H_{\mathrm{eucl}}" className="text-[11px]" />
            </span>
          </div>
          <MatrixDisplay matrix={hessian.euclideanHessian} label="H_{\mathrm{eucl}}" />
        </div>

        {/* Subsection 7.3: Geometric Hessian */}
        <div className={`border-t pt-4 mt-4 ${isLight ? 'border-zinc-100' : 'border-zinc-800/80'}`}>
          <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            <span>Geometric Hessian</span>
            <span className="normal-case font-normal select-all">
              <KaTeX math="H_{\text{geom}}" className="text-[11px]" />
            </span>
          </div>
          <MatrixDisplay matrix={hessian.geometricHessian} label="H_{geom}" />
        </div>

        {/* Subsection 7.4: Total Ambient Hessian */}
        <div className={`border-t pt-4 mt-4 ${isLight ? 'border-zinc-100' : 'border-zinc-800/80'}`}>
          <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            <span>Total Ambient Hessian</span>
            <span className="normal-case font-normal select-all">
              <KaTeX math="H_{\text{total}}" className="text-[11px]" />
            </span>
          </div>
          <MatrixDisplay matrix={hessian.totalAmbientHessian} label="H_{total}" />
        </div>

        {/* Subsection 7.5: Intrinsic Hessian */}
        <div className={`border-t pt-4 mt-4 ${isLight ? 'border-zinc-100' : 'border-zinc-800/80'}`}>
          <div className={`flex items-center gap-1.5 mb-1 text-[10px] font-bold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>
            <span>Intrinsic (Projected) Hessian</span>
            <span className="normal-case font-normal select-all">
              <KaTeX math="H_\mathrm{intr}" className="text-[11px]" />
            </span>
          </div>
          {constraints.dimension === 0 ? (
            <div className={`p-3 rounded border text-xs italic text-center ${isLight ? 'bg-zinc-50 border-zinc-100 text-zinc-400' : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'}`}>
              Intrinsic Hessian is empty.
            </div>
          ) : (
            <MatrixDisplay matrix={hessian.intrinsicHessian} label="H_\mathrm{intr}" />
          )}
        </div>
      </CollapsibleSection>

      {/* Section 8: Eigenvalues */}
      <CollapsibleSection title="Eigenvalues of Intrinsic Hessian" defaultOpen={true}>
        <EigenvalueDisplay 
          eigenvalues={hessian.eigenvalues} 
          isLocalMinimum={hessian.isLocalMinimum}
        />
      </CollapsibleSection>
    </div>
  );
}
