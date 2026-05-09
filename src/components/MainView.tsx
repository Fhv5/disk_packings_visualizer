'use client';
import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { Gallery } from './Gallery';
import { Workspace } from './Workspace/Workspace';
import { Sun, Moon } from 'lucide-react';

export function MainView() {
  const loadedFiles = useAppStore(state => state.loadedFiles);
  const selectedClass = useAppStore(state => state.selectedClass);
  const setSelectedClass = useAppStore(state => state.setSelectedClass);
  const theme = useAppStore(state => state.theme);
  const toggleTheme = useAppStore(state => state.toggleTheme);
  
  const errors = useAppStore(state => state.errors);
  const warnings = useAppStore(state => state.warnings);
  const clearErrors = useAppStore(state => state.clearErrors);
  const clearWarnings = useAppStore(state => state.clearWarnings);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const navEntries = window.performance?.getEntriesByType?.('navigation');
      const isBackForward = window.performance?.navigation?.type === 2 || 
                            (navEntries && navEntries[0] && (navEntries[0] as PerformanceNavigationTiming).type === 'back_forward');
      
      if ((window as any).__alreadyLoaded || isBackForward) {
        setTimeout(() => {
          window.location.replace(window.location.pathname + window.location.search);
        }, 50);
        return;
      }
      (window as any).__alreadyLoaded = true;
    }

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setTimeout(() => {
          window.location.replace(window.location.pathname + window.location.search);
        }, 50);
      }
    };

    const handleUnload = () => {};

    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('unload', handleUnload);
    
    return () => {
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const classId = params.get('class');
    if (classId) {
      const found = (loadedFiles || []).flatMap(f => f?.contactClasses || []).find(c => c?.id === classId);
      if (found) {
        useAppStore.setState({
          selectedClass: found,
          activeWorkspace: JSON.parse(JSON.stringify(found))
        });
      }
    }
  }, [loadedFiles]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentUrlClass = params.get('class');
    
    if (selectedClass) {
      if (currentUrlClass !== selectedClass.id) {
        window.history.pushState({ classId: selectedClass.id }, '', `?class=${selectedClass.id}`);
      }
    } else {
      if (currentUrlClass !== null) {
        window.history.pushState({ classId: null }, '', '/');
      }
    }
  }, [selectedClass]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const classId = params.get('class');
      
      const allClasses = (loadedFiles || []).flatMap(f => f?.contactClasses || []);
      if (classId) {
        const found = allClasses.find(c => c.id === classId);
        setSelectedClass(found || null);
      } else {
        setSelectedClass(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadedFiles, setSelectedClass]);

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden transition-colors duration-200 ${
      theme === 'light' ? 'bg-zinc-50 text-zinc-800' : 'bg-zinc-950 text-zinc-200'
    }`}>
      <header className={`flex-shrink-0 h-14 border-b flex items-center justify-between px-6 z-10 transition-colors duration-200 ${
        theme === 'light'
          ? 'bg-white/80 backdrop-blur-md border-zinc-200 shadow-sm'
          : 'bg-zinc-900/80 backdrop-blur-md border-zinc-800'
      }`}>
        <div className="flex items-center gap-4">
          <h1 className={`font-bold text-lg flex items-center gap-2 tracking-wide transition-colors duration-200 ${
            theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'
          }`}>
            <span className={`${theme === 'light' ? 'text-zinc-400' : 'text-zinc-300'} animate-pulse`}>●</span> Disk Packing Visualizer
          </h1>
          {selectedClass && (
            <>
              <div className={`w-px h-6 mx-2 transition-colors duration-200 ${
                theme === 'light' ? 'bg-zinc-200' : 'bg-zinc-800'
              }`}></div>
              <button 
                onClick={() => setSelectedClass(null)}
                className={`text-sm flex items-center gap-1 transition-colors ${
                  theme === 'light' ? 'text-zinc-500 hover:text-zinc-900 font-medium' : 'text-zinc-400 hover:text-zinc-100'
                }`}
              >
                &larr; Gallery
              </button>
              <span className={`text-sm font-mono font-semibold px-3 py-1 rounded-md transition-colors duration-200 ${
                theme === 'light' 
                  ? 'bg-zinc-100 border border-zinc-200 text-zinc-700' 
                  : 'bg-zinc-800/50 border border-zinc-700 text-zinc-300'
              }`}>
                {selectedClass.id}
              </span>
            </>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className={`p-2 rounded-lg border transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm ${
              theme === 'light'
                ? 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-zinc-300 hover:text-zinc-900'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 hover:text-white'
            }`}
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
        </div>
      </header>

      <div className="absolute top-16 right-6 z-50 flex flex-col gap-2 max-w-md">
        {errors.map((err, i) => (
          <div key={i} className="bg-red-950/90 backdrop-blur border border-red-900/50 border-l-4 border-l-red-500 p-4 rounded-md shadow-2xl relative animate-in slide-in-from-right-8">
            <p className="text-sm text-red-200 pr-6 font-medium">{err}</p>
            <button onClick={clearErrors} className="absolute top-2 right-2 text-red-500 hover:text-red-300 transition-colors">&times;</button>
          </div>
        ))}
        {warnings.map((warn, i) => (
          <div key={i} className="bg-amber-950/90 backdrop-blur border border-amber-900/50 border-l-4 border-l-amber-500 p-4 rounded-md shadow-2xl relative animate-in slide-in-from-right-8">
            <p className="text-sm text-amber-200 pr-6 font-medium">{warn}</p>
            <button onClick={clearWarnings} className="absolute top-2 right-2 text-amber-500 hover:text-amber-300 transition-colors">&times;</button>
          </div>
        ))}
      </div>

      <main className="flex-1 overflow-hidden relative">
        {selectedClass ? (
          <Workspace />
        ) : (
          <Gallery />
        )}
      </main>
    </div>
  );
}
