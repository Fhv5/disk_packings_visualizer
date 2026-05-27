'use client';
import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface CollapsibleSectionProps {
  title: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const theme = useAppStore(state => state.theme);
  const isLight = theme === 'light';

  return (
    <div className={`border rounded-lg overflow-hidden my-2 transition-colors duration-200 shadow-sm ${
      isLight ? 'border-zinc-200 bg-white' : 'border-zinc-800/80 bg-zinc-950'
    }`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center px-4 py-2.5 transition-colors duration-200 font-medium text-xs border-b cursor-pointer ${
          isLight 
            ? 'bg-zinc-50 hover:bg-zinc-100 text-zinc-700 border-zinc-200' 
            : 'bg-zinc-900/60 hover:bg-zinc-800/50 text-zinc-300 border-zinc-800/80'
        }`}
      >
        {typeof title === 'string' ? (
          <span className={`font-bold tracking-wide uppercase text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>{title}</span>
        ) : (
          title
        )}
        {isOpen ? (
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
        )}
      </button>
      {isOpen && (
        <div className={`p-4 ${isLight ? 'bg-white' : 'bg-zinc-950/60'}`}>
          {children}
        </div>
      )}
    </div>
  );
}

