'use client';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { SidePanel } from './SidePanel';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { useAnalysis } from '@/lib/analysis/useAnalysis';
import { AnalysisPanel } from '../Analysis/AnalysisPanel';
import { RotateCcw } from 'lucide-react';

function WorkspaceAnalysisPanel() {
  const activeWorkspace = useAppStore(state => state.activeWorkspace);
  const { data, loading, error } = useAnalysis(activeWorkspace, true);

  return (
    <div className="flex flex-col h-full overflow-y-auto p-4 custom-scrollbar">
      <div className="flex justify-between items-center mb-4 select-none">
        <h3 className="font-bold text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Variational Analysis
        </h3>
        {loading && (
          <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded animate-pulse font-bold">
            COMPUTING
          </span>
        )}
      </div>
      <AnalysisPanel result={data} loading={false} error={error} />
    </div>
  );
}

export function Workspace() {
  const activeWorkspace = useAppStore(state => state.activeWorkspace);
  const theme = useAppStore(state => state.theme);
  const isAnalysisMode = useAppStore(state => state.isAnalysisMode);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(384); // 24rem = 384px default
  const [rightPanelWidth, setRightPanelWidth] = useState(320); // 20rem = 320px default
  const [isDraggingRight, setIsDraggingRight] = useState(false);

  // Keep left panel width within limits when window resizes or right panel state toggles
  useEffect(() => {
    const handleResize = () => {
      const rightW = isPanelOpen ? rightPanelWidth : 0;
      const minWidth = 280;
      const maxWidth = window.innerWidth - rightW;
      setLeftPanelWidth(prev => Math.max(minWidth, Math.min(prev, maxWidth)));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isPanelOpen, rightPanelWidth]);

  if (!activeWorkspace) return null;

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;

      const minWidth = 280;
      const rightW = isPanelOpen ? rightPanelWidth : 0;
      const maxWidth = window.innerWidth - rightW;

      const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleRightResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = startWidth + deltaX;

      const minWidth = 280;
      const leftW = isAnalysisMode ? leftPanelWidth : 0;
      const maxWidth = window.innerWidth - leftW;

      const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      setRightPanelWidth(clampedWidth);
    };

    const handlePointerUp = () => {
      setIsDraggingRight(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return (
    <div className="flex h-full w-full relative">
      {/* Analysis Mode Left Panel */}
      {isAnalysisMode && (
        <div 
          style={{ width: leftPanelWidth }}
          className={`relative flex-shrink-0 shadow-xl overflow-hidden flex flex-col h-full border-r transition-colors duration-200 ${
            theme === 'light'
              ? 'bg-zinc-50 border-zinc-200'
              : 'bg-zinc-900 border-zinc-800'
          }`}
        >
          <WorkspaceAnalysisPanel />
          
          {/* Resize Handle */}
          <div 
            className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-amber-500/85 active:bg-amber-600 transition-colors duration-150 z-30 group"
            onPointerDown={handleResizeStart}
            onDoubleClick={() => setLeftPanelWidth(384)}
            title="Drag to resize, double-click to reset"
          >
            {leftPanelWidth !== 384 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setLeftPanelWidth(384); }}
                className="absolute top-3 right-3 bg-white dark:bg-zinc-800 shadow-md p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-amber-500 hover:border-amber-500 transition-all opacity-0 group-hover:opacity-100"
                title="Reset left panel width"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className={`flex-1 relative overflow-hidden transition-colors duration-200 ${
        theme === 'light' ? 'bg-zinc-100' : 'bg-zinc-900'
      }`}>
        <WorkspaceCanvas />
      </div>

      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className={`absolute top-6 right-0 -translate-y-1/2 -translate-x-full z-10 p-1.5 rounded-l-md shadow-md cursor-pointer border ${
          theme === 'light'
            ? 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white'
        } ${isDraggingRight ? '' : 'transition-all duration-200'}`}
        style={{ right: isPanelOpen ? rightPanelWidth : 0 }}
        title={isPanelOpen ? "Collapse Panel" : "Expand Panel"}
      >
        {isPanelOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        )}
      </button>

      <div 
        className={`relative flex-shrink-0 shadow-xl overflow-hidden flex flex-col border-l ${
          theme === 'light'
            ? 'bg-white border-zinc-200'
            : 'bg-zinc-900 border-zinc-800'
        } ${!isPanelOpen ? 'w-0 border-none' : ''} ${
          isDraggingRight ? '' : 'transition-all duration-300'
        }`}
        style={isPanelOpen ? { width: rightPanelWidth } : { width: 0 }}
      >
        <div className="h-full flex flex-col" style={{ width: isPanelOpen ? rightPanelWidth : 0 }}>
          {isPanelOpen && <SidePanel />}
        </div>
        
        {/* Resize Handle for Right Panel */}
        {isPanelOpen && (
          <div 
            className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-amber-500/85 active:bg-amber-600 transition-colors duration-150 z-30 group"
            onPointerDown={handleRightResizeStart}
            onDoubleClick={() => setRightPanelWidth(320)}
            title="Drag to resize, double-click to reset"
          >
            {rightPanelWidth !== 320 && (
              <button 
                onClick={(e) => { e.stopPropagation(); setRightPanelWidth(320); }}
                className="absolute top-3 left-3 bg-white dark:bg-zinc-800 shadow-md p-1.5 rounded-md border border-zinc-200 dark:border-zinc-700 text-zinc-500 hover:text-amber-500 hover:border-amber-500 transition-all opacity-0 group-hover:opacity-100"
                title="Reset right panel width"
              >
                <RotateCcw size={12} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

