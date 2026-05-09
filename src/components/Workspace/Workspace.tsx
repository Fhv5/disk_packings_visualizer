'use client';
import { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { SidePanel } from './SidePanel';
import { WorkspaceCanvas } from './WorkspaceCanvas';

export function Workspace() {
  const activeWorkspace = useAppStore(state => state.activeWorkspace);
  const theme = useAppStore(state => state.theme);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  if (!activeWorkspace) return null;

  return (
    <div className="flex h-full w-full relative">
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
