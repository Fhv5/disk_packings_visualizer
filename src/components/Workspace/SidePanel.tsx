'use client';
import { useMemo, useState, useEffect, useRef } from 'react';
import { Pin, Undo2, Redo2, RotateCcw, ChevronDown, ChevronRight, Play, Pause, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { convexHull, calculatePerimeter, getSymbolicPerimeter, Point2D } from '@/lib/geometry';
import { exactPerimeter } from '@/lib/analysis/perimeter';
import { evaluateMath, getEvaluatedBig } from '@/lib/parser';
import { math } from '@/lib/math';
import type { ParsedCoordinate } from '@/lib/types';

function formatCoordinate(coord: ParsedCoordinate, precision: number, isRolling: boolean = false): string {
  if (isRolling) {
    return coord.floatValue.toFixed(precision);
  }
  try {
    const val = getEvaluatedBig(coord);
    const type = math.typeOf(val);
    if (type === 'BigNumber') {
      return (val as any).toFixed(precision);
    } else if (type === 'Fraction') {
      return math.bignumber(val).toFixed(precision);
    } else if (typeof val === 'number') {
      return math.bignumber(val).toFixed(precision);
    }
    return coord.floatValue.toFixed(precision);
  } catch {
    return coord.floatValue.toFixed(precision);
  }
}

export function SidePanel() {
  const workspace = useAppStore(state => state.activeWorkspace);
  const theme = useAppStore(state => state.theme);
  const isSelfUpdatingRef = useRef(false);
  const lastCentersRef = useRef(workspace?.centers);

  useEffect(() => {
    if (!workspace) return;
    
    if (workspace.centers !== lastCentersRef.current) {
      if (!isSelfUpdatingRef.current) {
        setLocalInputs(prev => Object.keys(prev).length === 0 ? prev : {});
      }
      lastCentersRef.current = workspace.centers;
    }
    isSelfUpdatingRef.current = false;
  }, [workspace?.centers]);
  const updateWorkspaceCenters = useAppStore(state => state.updateWorkspaceCenters);
  const pinnedDisks = useAppStore(state => state.pinnedDisks);
  const togglePin = useAppStore(state => state.togglePin);
  const perimeterHistory = useAppStore(state => state.perimeterHistory);
  const pushPerimeterHistory = useAppStore(state => state.pushPerimeterHistory);
  const clearPerimeterHistory = useAppStore(state => state.clearPerimeterHistory);
  
  const rollingRules = useAppStore(state => state.rollingRules);
  const isRolling = useAppStore(state => state.isRolling);
  
  const addRollingRule = useAppStore(state => state.addRollingRule);
  const updateRollingRule = useAppStore(state => state.updateRollingRule);
  const removeRollingRule = useAppStore(state => state.removeRollingRule);
  const clearRollingRules = useAppStore(state => state.clearRollingRules);
  const setIsRolling = useAppStore(state => state.setIsRolling);
  const stepRoll = useAppStore(state => state.stepRoll);
  const stopOnCritical = useAppStore(state => state.stopOnCritical);
  const setStopOnCritical = useAppStore(state => state.setStopOnCritical);

  const selectedClass = useAppStore(state => state.selectedClass);
  const selectedDisks = useAppStore(state => state.selectedDisks);

  const undoStacks = useAppStore(state => state.undoStacks);
  const redoStacks = useAppStore(state => state.redoStacks);
  
  const snapshotDisk = useAppStore(state => state.snapshotDisk);
  const undoDisk = useAppStore(state => state.undoDisk);
  const redoDisk = useAppStore(state => state.redoDisk);
  const restoreDisk = useAppStore(state => state.restoreDisk);

  const [localInputs, setLocalInputs] = useState<Record<number, { x: string; y: string }>>({});
  const [precision, setPrecision] = useState(6);
  const [precisionInput, setPrecisionInput] = useState('6');

  useEffect(() => {
    setLocalInputs({});
    setPrecisionInput(precision.toString());
  }, [precision]);

  const [showHistory, setShowHistory] = useState(true);
  const [showCoords, setShowCoords] = useState(true);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showMotors, setShowMotors] = useState(true);
  const [showSymbolicPerimeter, setShowSymbolicPerimeter] = useState(true);

  const metricsRef = useRef<{ perimeter: any, hullVertices: number, symbolicPerimeter: any }>({ perimeter: 0, hullVertices: 0, symbolicPerimeter: null });
  const lastMetricsTimeRef = useRef(0);

  const metrics = useMemo(() => {
    if (!workspace) return { perimeter: 0, hullVertices: 0, symbolicPerimeter: null };
    
    const floatCenters = workspace.centers.map(([x, y]) => [x.floatValue, y.floatValue]) as Point2D[];
    const hull = convexHull(floatCenters);

    if (isRolling) {
      return {
        perimeter: calculatePerimeter(hull),
        hullVertices: hull.length,
        symbolicPerimeter: getSymbolicPerimeter(hull)
      };
    }
    
    const result = {
      perimeter: exactPerimeter(workspace.centers as [ParsedCoordinate, ParsedCoordinate][]),
      hullVertices: hull.length,
      symbolicPerimeter: getSymbolicPerimeter(hull)
    };
    metricsRef.current = result;
    return result;
  }, [workspace, isRolling]);

  if (!workspace) return null;

  const handleFocus = (idx: number) => {
    snapshotDisk(idx);
  };

  const handleCoordinateChange = (idx: number, type: 'x' | 'y', value: string) => {
    const currentInput = localInputs[idx] || {
      x: formatCoordinate(workspace.centers[idx][0], precision, isRolling),
      y: formatCoordinate(workspace.centers[idx][1], precision, isRolling)
    };
    const updated = { ...currentInput, [type]: value };
    setLocalInputs({
      ...localInputs,
      [idx]: updated
    });

    try {
      const px = evaluateMath(updated.x);
      const py = evaluateMath(updated.y);
      if (!isNaN(px) && !isNaN(py)) {
        const parsedCenters = [...workspace.centers];
        parsedCenters[idx] = [
          { floatValue: px, symbolicAst: math.parse(updated.x) },
          { floatValue: py, symbolicAst: math.parse(updated.y) }
        ];
        isSelfUpdatingRef.current = true;
        updateWorkspaceCenters(parsedCenters);
        pushPerimeterHistory(Number(exactPerimeter(parsedCenters)));
      }
    } catch (e) {
    }
  };

  const handleUndo = (idx: number) => {
    undoDisk(idx);
    setLocalInputs(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const handleRedo = (idx: number) => {
    redoDisk(idx);
    setLocalInputs(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const handleRestore = (idx: number) => {
    restoreDisk(idx);
    setLocalInputs(prev => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
  };

  const renderChart = () => {
    if (perimeterHistory.length === 0) return null;
    
    const minP = Math.min(...perimeterHistory);
    const maxP = Math.max(...perimeterHistory);
    const range = maxP - minP || 1;
    
    const width = 280;
    const height = 60;
    
    const points = perimeterHistory.map((p, i) => {
      const x = (i / Math.max(1, perimeterHistory.length - 1)) * width;
      const y = height - ((p - minP) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible mt-2">
        <line x1="0" y1={height/2} x2={width} y2={height/2} stroke={theme === 'light' ? '#e4e4e7' : '#27272a'} strokeWidth="1" strokeDasharray="2,2" />
        <polyline 
          points={points} 
          fill="none" 
          stroke={theme === 'light' ? '#71717a' : '#a1a1aa'} 
          strokeWidth="1.5"
          strokeLinejoin="round"
          style={{ filter: theme === 'light' ? 'none' : 'drop-shadow(0 0 4px rgba(161, 161, 170, 0.5))' }}
        />
        {perimeterHistory.length > 0 && (
          <circle 
            cx={width} 
            cy={height - ((perimeterHistory[perimeterHistory.length - 1] - minP) / range) * height} 
            r="3" 
            fill={theme === 'light' ? '#27272a' : '#f4f4f5'}
            style={{ filter: theme === 'light' ? 'none' : 'drop-shadow(0 0 6px rgba(244, 244, 245, 0.8))' }}
          />
        )}
      </svg>
    );
  };

  return (
    <div className={`flex flex-col h-full border-l transition-colors duration-200 ${
      theme === 'light' ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-zinc-900 border-zinc-800 text-zinc-300'
    }`}>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className={`p-4 border-b transition-colors duration-200 ${
          theme === 'light' ? 'border-zinc-200 bg-white/50' : 'border-zinc-800 bg-zinc-900/50'
        }`}>
        <div className="flex justify-between items-center cursor-pointer group mb-1" onClick={() => setShowMetrics(!showMetrics)}>
          <h2 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
            theme === 'light' ? 'text-zinc-500 group-hover:text-zinc-800' : 'text-zinc-400 group-hover:text-zinc-300'
          }`}>
            {showMetrics ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" />}
            Metrics
          </h2>
          <span className={`text-xs font-bold font-mono border rounded px-2 py-0.5 transition-colors duration-200 ${
            theme === 'light' ? 'text-zinc-700 bg-zinc-100 border-zinc-200 shadow-sm' : 'text-zinc-300 bg-zinc-800 border-zinc-800'
          }`}>{workspace.id}</span>
        </div>
        
        {showMetrics && (
          <div className="grid grid-cols-2 gap-3 text-sm mt-3">
            <div className={`flex flex-col p-2 rounded-md border transition-colors duration-200 ${
              theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-950 border-zinc-800/50 text-zinc-400'
            }`}>
              <span className={`text-[10px] uppercase tracking-wider mb-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>DoF</span>
              <span className={`font-mono font-bold ${
                workspace.dof === 0 
                  ? (theme === 'light' ? 'text-emerald-600' : 'text-emerald-400') 
                  : workspace.dof > 0 
                    ? (theme === 'light' ? 'text-amber-600' : 'text-amber-400') 
                    : (theme === 'light' ? 'text-red-600' : 'text-red-400')
              }`}>
                {workspace.dof}
              </span>
            </div>
            <div className={`flex flex-col p-2 rounded-md border transition-colors duration-200 ${
              theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-950 border-zinc-800/50 text-zinc-400'
            }`}>
              <span className={`text-[10px] uppercase tracking-wider mb-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Perimeter</span>
              <span 
                className={`font-mono transition-colors duration-200 ${theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'} ${metrics.symbolicPerimeter ? 'cursor-pointer hover:opacity-70' : ''}`}
                onClick={() => metrics.symbolicPerimeter && setShowSymbolicPerimeter(prev => !prev)}
                title={metrics.symbolicPerimeter ? "Toggle exact value" : ""}
              >
                {showSymbolicPerimeter && metrics.symbolicPerimeter ? metrics.symbolicPerimeter : metrics.perimeter.toFixed(precision)}
              </span>
            </div>
            <div className={`flex flex-col col-span-2 p-2 rounded-md border transition-colors duration-200 ${
              theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-950 border-zinc-800/50 text-zinc-400'
            }`}>
              <span className={`text-[10px] uppercase tracking-wider mb-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Hull Vertices</span>
              <span className={`font-mono transition-colors duration-200 ${theme === 'light' ? 'text-zinc-800' : 'text-zinc-200'}`}>
                {metrics.hullVertices}
              </span>
            </div>
            
            {/* Precision control */}
            <div className={`flex justify-between items-center col-span-2 p-2 rounded-md border transition-colors duration-200 ${
              theme === 'light' ? 'bg-white border-zinc-200 shadow-sm' : 'bg-zinc-950 border-zinc-800/50 text-zinc-400'
            }`}>
              <span className={`text-[10px] uppercase tracking-wider ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Precision</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPrecision(prev => Math.max(2, prev - 1))}
                  disabled={precision <= 2}
                  className={`w-5 h-5 rounded flex items-center justify-center border font-bold text-xs select-none cursor-pointer transition-colors ${
                    theme === 'light'
                      ? 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                  title="Decrease Decimal Precision"
                >
                  -
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={precisionInput}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setPrecisionInput(val);
                  }}
                  onBlur={() => {
                    const parsed = parseInt(precisionInput, 10);
                    if (!isNaN(parsed)) {
                      const clamped = Math.max(2, Math.min(64, parsed));
                      setPrecision(clamped);
                      setPrecisionInput(clamped.toString());
                    } else {
                      setPrecisionInput(precision.toString());
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className={`text-xs font-mono font-bold w-8 text-center bg-transparent border-b border-dashed border-zinc-400 focus:border-solid focus:border-amber-500 focus:outline-none focus:ring-0 px-0.5 py-0 ${
                    theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'
                  }`}
                  title="Decimal precision (2-64). Click to edit."
                />
                <button
                  onClick={() => setPrecision(prev => Math.min(64, prev + 1))}
                  disabled={precision >= 64}
                  className={`w-5 h-5 rounded flex items-center justify-center border font-bold text-xs select-none cursor-pointer transition-colors ${
                    theme === 'light'
                      ? 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed'
                      : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed'
                  }`}
                  title="Increase Decimal Precision"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={`p-4 border-b transition-colors duration-200 ${
        theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'
      }`}>
        <div className="flex justify-between items-center cursor-pointer group" onClick={() => setShowHistory(!showHistory)}>
          <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
            theme === 'light' ? 'text-zinc-500 group-hover:text-zinc-800' : 'text-zinc-400 group-hover:text-zinc-300'
          }`}>
            {showHistory ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" />}
            Perimeter History
          </h3>
          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
            {perimeterHistory.length > 0 && (
              <button 
                onClick={clearPerimeterHistory}
                className={`text-[10px] uppercase font-bold tracking-wider transition-colors cursor-pointer ${
                  theme === 'light' ? 'text-zinc-400 hover:text-red-500' : 'text-zinc-500 hover:text-red-400'
                }`}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        {showHistory && (
          <div className={`h-16 w-full flex items-end justify-center text-xs mt-3 rounded border overflow-hidden relative transition-colors duration-200 ${
            theme === 'light' ? 'bg-white border-zinc-200 text-zinc-400 shadow-sm' : 'bg-zinc-950/50 border-zinc-800/50 text-zinc-500'
          }`}>
            {perimeterHistory.length === 0 ? (
              <span className="mb-6">Drag disks to record history</span>
            ) : (
              renderChart()
            )}
          </div>
        )}
      </div>

      <div className={`p-4 border-b transition-colors duration-200 ${
        theme === 'light' ? 'border-zinc-200 bg-zinc-50/50' : 'border-zinc-800 bg-zinc-900'
      }`}>
        <div className="flex justify-between items-center cursor-pointer group" onClick={() => setShowMotors(!showMotors)}>
          <h3 className={`text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors ${
            theme === 'light' ? 'text-zinc-500 group-hover:text-zinc-800' : 'text-zinc-400 group-hover:text-zinc-300'
          }`}>
            {showMotors ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" />}
            Motors ({rollingRules.length})
          </h3>
          <div className="flex gap-2.5" onClick={e => e.stopPropagation()}>
            {rollingRules.length > 0 && (
              <button 
                onClick={clearRollingRules} 
                className={`text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                  theme === 'light' ? 'text-zinc-400 hover:text-red-500' : 'text-zinc-500 hover:text-red-400'
                }`}
              >
                <Trash2 size={10} />
                Clear
              </button>
            )}
            <button 
              onClick={addRollingRule} 
              className={`text-[10px] uppercase font-bold tracking-wider flex items-center gap-1 transition-colors cursor-pointer ${
                theme === 'light' ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Plus size={11} />
              Add
            </button>
          </div>
        </div>

        {showMotors && (
          <div className="mt-3">
            <div className="space-y-3 max-h-48 overflow-y-auto mb-3 pr-1 custom-scrollbar">
              {rollingRules.map((rule, index) => (
                <div key={rule.id} className={`border p-3 text-xs relative transition-all rounded-lg ${
                  theme === 'light'
                    ? (rule.isActive ? 'bg-white border-zinc-300' : 'bg-zinc-100/50 border-zinc-200 opacity-60')
                    : (rule.isActive ? 'bg-zinc-950 border-zinc-700' : 'border-zinc-800 opacity-50')
                }`}>
                  <div className="absolute top-2.5 right-2 flex gap-1.5">
                    <button 
                      onClick={() => updateRollingRule(rule.id, { isActive: !rule.isActive })}
                      className={`p-1 rounded flex items-center justify-center transition-colors cursor-pointer ${
                        theme === 'light'
                          ? (rule.isActive ? 'text-zinc-700 bg-zinc-200 hover:bg-zinc-300' : 'text-zinc-400 bg-zinc-100 hover:bg-zinc-200')
                          : (rule.isActive ? 'text-zinc-200 bg-zinc-700 hover:bg-zinc-600' : 'text-zinc-500 bg-zinc-800 hover:bg-zinc-700')
                      }`}
                      title={rule.isActive ? "Pause this motor" : "Play this motor"}
                    >
                      {rule.isActive ? <Pause size={10} /> : <Play size={10} />}
                    </button>
                    <button 
                      onClick={() => removeRollingRule(rule.id)}
                      className={`p-1 rounded flex items-center justify-center transition-colors cursor-pointer ${
                        theme === 'light' ? 'text-zinc-400 hover:text-red-500 hover:bg-red-50' : 'text-zinc-400 hover:text-red-400 hover:bg-red-900/20'
                      }`}
                      title="Remove Motor"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                  
                  <div className="flex gap-3 mb-3 pr-14 mt-1">
                    <div className="flex-1">
                      <label className={`text-[9px] uppercase font-bold block mb-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Pivot</label>
                      <select 
                        className={`w-full p-1.5 border rounded outline-none text-xs transition-colors cursor-pointer ${
                          theme === 'light'
                            ? 'bg-white border-zinc-200 text-zinc-800 focus:border-zinc-400'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-500'
                        }`}
                        value={rule.pivotDiskIdx === null ? "" : rule.pivotDiskIdx}
                        onChange={e => updateRollingRule(rule.id, { pivotDiskIdx: e.target.value === "" ? null : Number(e.target.value) })}
                      >
                        <option value="">None</option>
                        {workspace.centers.map((_, i) => <option key={i} value={i}>D{i}</option>)}
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className={`text-[9px] uppercase font-bold block mb-1 ${theme === 'light' ? 'text-zinc-400' : 'text-zinc-500'}`}>Roll</label>
                      <select 
                        className={`w-full p-1.5 border rounded outline-none text-xs transition-colors cursor-pointer ${
                          theme === 'light'
                            ? 'bg-white border-zinc-200 text-zinc-800 focus:border-zinc-400'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-500'
                        }`}
                        value={rule.rollingDiskIdx === null ? "" : rule.rollingDiskIdx}
                        onChange={e => updateRollingRule(rule.id, { rollingDiskIdx: e.target.value === "" ? null : Number(e.target.value) })}
                      >
                        <option value="">None</option>
                        {workspace.centers.map((_, i) => <option key={i} value={i}>D{i}</option>)}
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 items-center">
                    <div className="w-1/2">
                      <input 
                        type="number" min="0.01" max="20.0" step="0.1" 
                        value={rule.speed}
                        onChange={e => updateRollingRule(rule.id, { speed: Number(e.target.value) })}
                        className={`w-full p-1.5 border rounded outline-none text-xs transition-colors ${
                          theme === 'light'
                            ? 'bg-white border-zinc-200 text-zinc-800 focus:border-zinc-400'
                            : 'bg-zinc-900 border-zinc-700 text-zinc-200 focus:border-zinc-500'
                        }`}
                        title="Speed in Rad/s"
                      />
                    </div>
                    <button 
                      className={`flex-1 border rounded p-1.5 text-xs transition-colors font-medium cursor-pointer ${
                        theme === 'light'
                          ? 'border-zinc-200 text-zinc-700 bg-zinc-50 hover:bg-zinc-100 shadow-sm'
                          : 'border-zinc-700 text-zinc-300 bg-zinc-800 hover:bg-zinc-700'
                      }`}
                      onClick={() => updateRollingRule(rule.id, { direction: rule.direction === 1 ? -1 : 1 })}
                    >
                      {rule.direction === 1 ? '↻ CW' : '↺ CCW'}
                    </button>
                  </div>
                </div>
              ))}
              {rollingRules.length === 0 && (
                <div className={`text-center text-xs py-4 border border-dashed rounded-lg transition-colors duration-200 ${
                  theme === 'light'
                    ? 'text-zinc-400 border-zinc-200 bg-white shadow-sm'
                    : 'text-zinc-500 border-zinc-700 bg-zinc-950/50'
                }`}>
                  No active motors.
                </div>
              )}
            </div>

            {/* Auto-stop on critical toggle */}
            <div className="flex items-center gap-3 mb-3 mt-1.5 px-1.5 py-1">
              <button
                type="button"
                onClick={() => setStopOnCritical(!stopOnCritical)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full p-0.5 items-center transition-colors duration-200 ease-in-out focus:outline-none ${
                  stopOnCritical 
                    ? 'bg-amber-600' 
                    : (theme === 'light' ? 'bg-zinc-300' : 'bg-zinc-700')
                }`}
                title="Toggle Auto-stop on Critical Point"
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                    stopOnCritical ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
              <span 
                onClick={() => setStopOnCritical(!stopOnCritical)}
                className={`text-xs font-semibold cursor-pointer select-none transition-colors ${
                  theme === 'light' ? 'text-zinc-600 hover:text-zinc-800' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Auto-stop on Critical Point
              </span>
            </div>
            
            <div className={`flex gap-2 pt-3 border-t mt-2 transition-colors duration-200 ${
              theme === 'light' ? 'border-zinc-200' : 'border-zinc-800'
            }`}>
              <button 
                className={`flex-1 text-xs py-2 rounded-md font-bold text-white shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isRolling 
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-900/20' 
                    : (theme === 'light' ? 'bg-zinc-800 hover:bg-zinc-700 shadow-zinc-200/50' : 'bg-zinc-700 hover:bg-zinc-600 shadow-zinc-900/20')
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                disabled={rollingRules.length === 0 || rollingRules.some(r => r.pivotDiskIdx === null || r.rollingDiskIdx === null)}
                onClick={() => setIsRolling(!isRolling)}
              >
                {isRolling ? <Pause size={12} /> : <Play size={12} />}
                {isRolling ? 'PAUSE GLOBAL' : 'PLAY GLOBAL'}
              </button>
              <button 
                className={`px-4 text-xs py-2 rounded-md font-bold border transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-zinc-200 text-zinc-600 bg-white hover:bg-zinc-50 shadow-sm'
                    : 'border-zinc-600 text-zinc-300 bg-zinc-800 hover:bg-zinc-700 shadow-sm'
                } disabled:opacity-50`}
                disabled={isRolling || rollingRules.length === 0}
                onClick={stepRoll}
                title="Step forward manually"
              >
                STEP
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`p-4 transition-colors duration-200 ${
        theme === 'light' ? 'bg-white/50' : ''
      }`}>
        <h3 className={`text-xs font-bold uppercase tracking-wider mb-3 cursor-pointer flex items-center gap-1.5 group transition-colors ${
          theme === 'light' ? 'text-zinc-500 group-hover:text-zinc-800' : 'text-zinc-400 group-hover:text-zinc-300'
        }`} onClick={() => setShowCoords(!showCoords)}>
          {showCoords ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" /> : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-400" />}
          Disk Coordinates
        </h3>
        
        {showCoords && (
          <div className="flex flex-col gap-2">
            {workspace.centers.map(([x, y], idx) => {
              const isSelectedMode = selectedDisks.size > 0;
              if (isSelectedMode && !selectedDisks.has(idx)) return null;
              
              const isPinned = pinnedDisks.has(idx);
              const currentInput = localInputs[idx] || { x: formatCoordinate(x, precision, isRolling), y: formatCoordinate(y, precision, isRolling) };
              const hasUndo = (undoStacks[idx] || []).length > 0;
              const hasRedo = (redoStacks[idx] || []).length > 0;
              
              return (
                <div key={idx} className={`border rounded-lg p-2 text-xs flex flex-col gap-1.5 transition-all ${
                  isPinned 
                    ? (theme === 'light' ? 'bg-red-50/50 border-red-200 text-red-700 shadow-sm' : 'bg-red-950/20 border-red-900/40') 
                    : (theme === 'light' ? 'bg-white border-zinc-200 shadow-sm text-zinc-700' : 'bg-zinc-950 border-zinc-800')
                }`}>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold transition-colors duration-200 ${
                        isPinned 
                          ? 'text-red-500' 
                          : (theme === 'light' ? 'text-zinc-800' : 'text-zinc-300')
                      }`}>Disk {idx}</span>
                      {isPinned && <span className={`text-[9px] px-1 py-0.5 rounded font-bold uppercase tracking-wider leading-none transition-colors duration-200 ${
                        theme === 'light' ? 'bg-red-100 text-red-600' : 'bg-red-900/40 text-red-400'
                      }`}>Pinned</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleRestore(idx)}
                        className={`transition-colors p-0.5 cursor-pointer ${
                          theme === 'light' ? 'text-zinc-400 hover:text-zinc-700' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                        title="Restore to original starting position"
                      >
                        <RotateCcw size={11} />
                      </button>
                      
                      <button 
                        onClick={() => handleUndo(idx)}
                        disabled={!hasUndo}
                        className={`transition-colors p-0.5 ${
                          hasUndo 
                            ? (theme === 'light' ? 'text-zinc-600 hover:text-zinc-900 cursor-pointer' : 'text-zinc-400 hover:text-zinc-200 cursor-pointer') 
                            : (theme === 'light' ? 'text-zinc-200 cursor-not-allowed' : 'text-zinc-800 cursor-not-allowed')
                        }`}
                        title="Undo"
                      >
                        <Undo2 size={11} />
                      </button>
                      
                      <button 
                        onClick={() => handleRedo(idx)}
                        disabled={!hasRedo}
                        className={`transition-colors p-0.5 ${
                          hasRedo 
                            ? (theme === 'light' ? 'text-zinc-600 hover:text-zinc-900 cursor-pointer' : 'text-zinc-400 hover:text-zinc-200 cursor-pointer') 
                            : (theme === 'light' ? 'text-zinc-200 cursor-not-allowed' : 'text-zinc-800 cursor-not-allowed')
                        }`}
                        title="Redo"
                      >
                        <Redo2 size={11} />
                      </button>
                      
                      <button 
                        onClick={() => togglePin(idx)}
                        className={`transition-colors p-0.5 cursor-pointer ${isPinned ? 'text-red-500 hover:text-red-400' : 'text-zinc-400 hover:text-zinc-600'}`}
                        title={isPinned ? "Unpin disk" : "Pin disk"}
                      >
                        <Pin size={11} className={isPinned ? 'fill-current' : ''} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400 pointer-events-none">X</span>
                      <input 
                        type="text" 
                        value={currentInput.x} 
                        onChange={e => handleCoordinateChange(idx, 'x', e.target.value)}
                        onFocus={() => handleFocus(idx)}
                        className={`w-full border outline-none rounded pl-4 pr-1.5 font-mono text-[11px] py-1 transition-colors ${
                          isPinned 
                            ? (theme === 'light' ? 'text-red-600 border-red-200 bg-white focus:border-red-400' : 'text-red-400 border-red-900/30 focus:border-red-500') 
                            : (theme === 'light' ? 'text-zinc-800 border-zinc-200 bg-white focus:border-zinc-400 shadow-sm' : 'text-zinc-200 border-zinc-800 bg-zinc-900 focus:border-zinc-600')
                        }`}
                        placeholder="X"
                      />
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-zinc-400 pointer-events-none">Y</span>
                      <input 
                        type="text" 
                        value={currentInput.y} 
                        onChange={e => handleCoordinateChange(idx, 'y', e.target.value)}
                        onFocus={() => handleFocus(idx)}
                        className={`w-full border outline-none rounded pl-4 pr-1.5 font-mono text-[11px] py-1 transition-colors ${
                          isPinned 
                            ? (theme === 'light' ? 'text-red-600 border-red-200 bg-white focus:border-red-400' : 'text-red-400 border-red-900/30 focus:border-red-500') 
                            : (theme === 'light' ? 'text-zinc-800 border-zinc-200 bg-white focus:border-zinc-400 shadow-sm' : 'text-zinc-200 border-zinc-800 bg-zinc-900 focus:border-zinc-600')
                        }`}
                        placeholder="Y"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
