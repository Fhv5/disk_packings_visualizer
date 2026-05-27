'use client';
import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { SidePanel } from './SidePanel';
import { WorkspaceCanvas } from './WorkspaceCanvas';
import { useAnalysis } from '@/lib/analysis/useAnalysis';
import { AnalysisPanel } from '../Analysis/AnalysisPanel';

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
  const isAdvancedMode = useAppStore(state => state.isAdvancedMode);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(384); // 24rem = 384px default

  // Keep left panel width within limits when window resizes or right panel state toggles
  useEffect(() => {
    const handleResize = () => {
      const rightPanelWidth = isPanelOpen ? 320 : 0;
      const minWidth = 280;
      const maxWidth = window.innerWidth - rightPanelWidth;
      setLeftPanelWidth(prev => Math.max(minWidth, Math.min(prev, maxWidth)));
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isPanelOpen]);

  if (!activeWorkspace) return null;

  const handleResizeStart = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = startWidth + deltaX;

      const minWidth = 280;
      const rightPanelWidth = isPanelOpen ? 320 : 0; // 320px is 20rem
      const maxWidth = window.innerWidth - rightPanelWidth;

      const clampedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className="flex h-full w-full relative">
      {/* Advanced Mode Left Panel */}
      {isAdvancedMode && (
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
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-amber-500/85 active:bg-amber-600 transition-colors duration-150 z-30"
            onPointerDown={handleResizeStart}
          />
        </div>
      )}

      <div className={`flex-1 relative overflow-hidden transition-colors duration-200 ${
        theme === 'light' ? 'bg-zinc-100' : 'bg-zinc-900'
      }`}>
        <WorkspaceCanvas />
      </div>

      <button
        onClick={() => setIsPanelOpen(!isPanelOpen)}
        className={`absolute top-6 right-0 -translate-y-1/2 -translate-x-full z-10 p-1.5 rounded-l-md transition-all duration-200 shadow-md cursor-pointer border ${
          theme === 'light'
            ? 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800'
            : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white'
        }`}
        style={{ right: isPanelOpen ? '20rem' : '0' }}
        title={isPanelOpen ? "Collapse Panel" : "Expand Panel"}
      >
        {isPanelOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        )}
      </button>

      <div 
        className={`flex-shrink-0 shadow-xl overflow-hidden flex flex-col transition-all duration-300 border-l ${
          theme === 'light'
            ? 'bg-white border-zinc-200'
            : 'bg-zinc-900 border-zinc-800'
        } ${isPanelOpen ? 'w-80' : 'w-0'}`}
      >
        <div className="w-80 h-full flex flex-col">
          <SidePanel />
        </div>
      </div>
    </div>
  );
}

