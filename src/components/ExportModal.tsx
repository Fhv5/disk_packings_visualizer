import { useState } from 'react';
import { X, Download } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { convexHull, calculatePerimeter, getSymbolicPerimeter, Point2D } from '@/lib/geometry';

interface ExportModalProps {
  onClose: () => void;
}

export function ExportModal({ onClose }: ExportModalProps) {
  const theme = useAppStore(state => state.theme);
  const workspace = useAppStore(state => state.activeWorkspace);
  const loadedFiles = useAppStore(state => state.loadedFiles);
  const getFilteredClasses = useAppStore(state => state.getFilteredClasses);

  const [includeStructure, setIncludeStructure] = useState(true);
  const [includeDoF, setIncludeDoF] = useState(true);
  const [includeHullVertices, setIncludeHullVertices] = useState(true);
  const [includePerimeter, setIncludePerimeter] = useState(true);
  
  const isGlobalExport = !workspace;

  if (!workspace && (!loadedFiles || loadedFiles.length === 0)) return null;

  const handleExport = () => {
    const data: any = {};
    
    // Structure similar to ./data/*.json
    data.version = "1.1";
    data.indexing = "0-based";
    data.angles = "degrees";
    data.radius = "1";
    
    const graphs: any[] = [];
    
    const sources = isGlobalExport 
      ? getFilteredClasses()
      : [workspace];

    for (const source of sources) {
      if (!source) continue;
      
      const graph: any = {};
      
      if (includeStructure) {
        graph.discos = source.disksCount;
        graph.nombre = source.id;
        graph.centros = source.centers;
        graph.contactos = source.contacts;
      }
      
      if (includeDoF) {
        graph.dof = source.dof;
      }
      
      if (includeHullVertices || includePerimeter) {
        const hull = convexHull(source.centers as Point2D[]);
        if (includeHullVertices) {
          graph.hullVertices = hull.length;
        }
        if (includePerimeter) {
          const exact = getSymbolicPerimeter(hull);
          graph.perimeter = {
            numeric: calculatePerimeter(hull),
            symbolic: exact
          };
        }
      }
      graphs.push(graph);
    }
    
    data.graphs = graphs;

    const blob = new Blob([JSON.stringify(data, null, 4)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isGlobalExport ? 'all_configurations.json' : `${workspace?.id || 'export'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className={`w-full max-w-md p-6 rounded-xl shadow-2xl border transition-colors ${
        theme === 'light' ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
      }`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className={`text-xl font-bold ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>Export JSON Data</h2>
          <button onClick={onClose} className={`p-1 rounded-md transition-colors cursor-pointer ${
            theme === 'light' ? 'hover:bg-zinc-100 text-zinc-500' : 'hover:bg-zinc-800 text-zinc-400'
          }`}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <div className="mb-6 pb-4 border-b border-zinc-200 dark:border-zinc-800">
            <p className={`text-sm italic ${theme === 'light' ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {isGlobalExport 
                ? "This will export all currently loaded and filtered configurations."
                : "This will export only the current configuration."}
            </p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={includeStructure} onChange={(e) => setIncludeStructure(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
            <span className={`text-sm font-medium ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>Basic Structure (centers, contacts)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={includeDoF} onChange={(e) => setIncludeDoF(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
            <span className={`text-sm font-medium ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>Degrees of Freedom (DoF)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={includeHullVertices} onChange={(e) => setIncludeHullVertices(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
            <span className={`text-sm font-medium ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>Hull Vertices Count</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={includePerimeter} onChange={(e) => setIncludePerimeter(e.target.checked)} className="w-4 h-4 rounded cursor-pointer" />
            <span className={`text-sm font-medium ${theme === 'light' ? 'text-zinc-700' : 'text-zinc-300'}`}>Perimeter (Numeric & Symbolic)</span>
          </label>
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
            theme === 'light' ? 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
          }`}>
            Cancel
          </button>
          <button 
            onClick={handleExport}
            disabled={!includeStructure && !includeDoF && !includeHullVertices && !includePerimeter}
            className={`px-4 py-2 text-sm font-medium rounded-md text-white flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              theme === 'light' ? 'bg-zinc-900 hover:bg-zinc-800' : 'bg-zinc-100 text-zinc-900 hover:bg-zinc-200'
            }`}
          >
            <Download size={16} />
            Download JSON
          </button>
        </div>
      </div>
    </div>
  );
}
