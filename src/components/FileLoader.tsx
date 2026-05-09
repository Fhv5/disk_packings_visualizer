'use client';
import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { parsePackingFile } from '@/lib/parser';

export function FileLoader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addLoadedFile = useAppStore((state) => state.addLoadedFile);
  const addErrors = useAppStore((state) => state.addErrors);
  const addWarnings = useAppStore((state) => state.addWarnings);
  const clearErrors = useAppStore((state) => state.clearErrors);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    clearErrors();
    const file = files[0];
    const text = await file.text();
    
    const { data, warnings, errors } = parsePackingFile(text, file.name);
    
    if (errors.length > 0) {
      addErrors(errors);
    }
    
    if (warnings.length > 0) {
      addWarnings(warnings);
    }
    
    if (data) {
      const isAlreadyLoaded = useAppStore.getState().loadedFiles.some(f => f.fileName === file.name);
      if (!isAlreadyLoaded) {
        addLoadedFile(data);
      }
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <input 
        type="file" 
        accept=".json" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        className="hidden" 
      />
      <button 
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white rounded-md shadow-lg shadow-zinc-900/20 transition-all text-sm font-semibold tracking-wide"
      >
        <Upload size={16} />
        Load JSON
      </button>
    </div>
  );
}
