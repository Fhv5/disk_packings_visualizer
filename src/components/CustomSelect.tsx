'use client';
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function CustomSelect({ value, onChange, options }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value) || options[0];
  const theme = useAppStore(state => state.theme);

  return (
    <div className="relative inline-block text-left select-none" style={{ minWidth: '135px' }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex justify-between items-center px-3 py-2 text-xs border rounded-lg outline-none cursor-pointer transition-all duration-200 font-medium shadow-md ${
          theme === 'light'
            ? 'bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 hover:border-zinc-300'
            : 'bg-zinc-900 border-zinc-700 hover:border-zinc-500 text-zinc-100'
        }`}
      >
        <span className="truncate mr-2">{selectedOption?.label}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 shrink-0 ${
          theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'
        } ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          <div className={`absolute right-0 mt-1.5 w-full min-w-[150px] border rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100 ${
            theme === 'light'
              ? 'bg-white border-zinc-200'
              : 'bg-zinc-900 border-zinc-700/80'
          }`}>
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer block truncate ${
                  opt.value === value 
                    ? (theme === 'light' ? 'bg-zinc-100 text-zinc-900 font-semibold' : 'bg-zinc-800 text-zinc-100 font-semibold') 
                    : (theme === 'light' ? 'text-zinc-700 hover:bg-zinc-50 hover:text-zinc-900' : 'text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100')
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
