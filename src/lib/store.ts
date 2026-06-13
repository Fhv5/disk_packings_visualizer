import { create } from 'zustand';
import { ParsedContactClass, ParsedFile, ParsedCoordinate } from './types';
import { parsePackingFile } from './parser';
import { math } from './math';

function cloneParsedContactClass(cls: ParsedContactClass): ParsedContactClass {
  return {
    ...cls,
    centers: cls.centers.map(([x, y]) => [
      { floatValue: x.floatValue, symbolicAst: x.symbolicAst.clone(), _evaluatedBig: x._evaluatedBig },
      { floatValue: y.floatValue, symbolicAst: y.symbolicAst.clone(), _evaluatedBig: y._evaluatedBig }
    ]),
    contacts: cls.contacts.map(([u, v]) => [u, v])
  };
}

const defaultFiles: ParsedFile[] = [];
try {
  // @ts-ignore
  const context = require.context('../../data', false, /\.json$/);
  context.keys().forEach((key: string) => {
    const data = context(key);
    const fileName = key.replace('./', '');
    const { data: parsedData, errors, warnings } = parsePackingFile(JSON.stringify(data), fileName);
    if (parsedData) {
      defaultFiles.push(parsedData);
    }
    if (errors && errors.length > 0) {
      console.error(`Error parsing ${fileName}:`, errors);
    }
    if (warnings && warnings.length > 0) {
      console.warn(`Warning parsing ${fileName}:`, warnings);
    }
  });
} catch (e) {
  console.error('Failed to parse default files in store', e);
}

export interface RollingRule {
  id: string;
  rollingDiskIdx: number | null;
  pivotDiskIdx: number | null;
  speed: number;
  direction: 1 | -1;
  isActive: boolean;
}

interface AppState {
  loadedFiles: ParsedFile[];
  selectedClass: ParsedContactClass | null;
  activeWorkspace: ParsedContactClass | null;
  pinnedDisks: Set<number>;
  perimeterHistory: number[];
  warnings: string[];
  errors: string[];
  
  rollingRules: RollingRule[];
  isRolling: boolean;
  rollTrigger: number;
  
  showGrid: boolean;
  selectedDisks: Set<number>;
  undoStacks: Record<number, [number, number][]>;
  redoStacks: Record<number, [number, number][]>;
  theme: 'dark' | 'light';

  searchQuery: string;
  diskFilter: string;
  contactFilter: string;
  dofFilter: string;
  sortBy: string;

  setSearchQuery: (query: string) => void;
  setDiskFilter: (filter: string) => void;
  setContactFilter: (filter: string) => void;
  setDofFilter: (filter: string) => void;
  setSortBy: (sort: string) => void;
  resetFilters: () => void;
  getFilteredClasses: () => ParsedContactClass[];

  addLoadedFile: (file: ParsedFile) => void;
  setSelectedClass: (cls: ParsedContactClass | null) => void;
  setActiveWorkspace: (cls: ParsedContactClass | null) => void;
  updateWorkspaceCenters: (centers: [number, number][] | [ParsedCoordinate, ParsedCoordinate][]) => void;
  togglePin: (idx: number) => void;
  pushPerimeterHistory: (p: number) => void;
  clearPerimeterHistory: () => void;
  addWarnings: (warnings: string[]) => void;
  addErrors: (errors: string[]) => void;
  clearErrors: () => void;
  clearWarnings: () => void;
  reset: () => void;
  restoreOriginalWorkspace: () => void;
  
  toggleSelectDisk: (idx: number, isShift: boolean) => void;
  clearSelectedDisks: () => void;
  
  snapshotDisk: (idx: number) => void;
  undoDisk: (idx: number) => void;
  redoDisk: (idx: number) => void;
  restoreDisk: (idx: number) => void;
  
  addRollingRule: () => void;
  updateRollingRule: (id: string, updates: Partial<RollingRule>) => void;
  removeRollingRule: (id: string) => void;
  clearRollingRules: () => void;
  setIsRolling: (isRolling: boolean) => void;
  stepRoll: () => void;
  
  toggleGrid: () => void;
  toggleTheme: () => void;
  isAnalysisMode: boolean;
  toggleAnalysisMode: () => void;
  goToNextConfig: () => void;
  goToPrevConfig: () => void;
  criticalityTolerance: number;
  setCriticalityTolerance: (tolerance: number) => void;
  stopOnCritical: boolean;
  setStopOnCritical: (stop: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  loadedFiles: defaultFiles,
  selectedClass: null,
  activeWorkspace: null,
  pinnedDisks: new Set(),
  perimeterHistory: [],
  warnings: [],
  errors: [],
  
  rollingRules: [],
  isRolling: false,
  rollTrigger: 0,
  
  showGrid: true,
  selectedDisks: new Set(),
  undoStacks: {},
  redoStacks: {},
  theme: 'dark',
  criticalityTolerance: 1e-6,
  stopOnCritical: false,
  
  searchQuery: '',
  diskFilter: 'all',
  contactFilter: 'all',
  dofFilter: 'all',
  sortBy: 'disks-asc',
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setDiskFilter: (filter) => set({ diskFilter: filter }),
  setContactFilter: (filter) => set({ contactFilter: filter }),
  setDofFilter: (filter) => set({ dofFilter: filter }),
  setSortBy: (sort) => set({ sortBy: sort }),
  resetFilters: () => set({
    searchQuery: '',
    diskFilter: 'all',
    contactFilter: 'all',
    dofFilter: 'all',
    sortBy: 'disks-asc'
  }),
  
  getFilteredClasses: () => {
    const state = get();
    const allClasses = state.loadedFiles.flatMap(f => f.contactClasses);
    let result = [...allClasses];

    if (state.searchQuery.trim() !== '') {
      const q = state.searchQuery.toLowerCase().trim();
      result = result.filter(c => 
        c.id.toLowerCase().includes(q) || 
        c.fileName.toLowerCase().includes(q)
      );
    }

    if (state.diskFilter !== 'all') {
      const val = Number(state.diskFilter);
      result = result.filter(c => c.disksCount === val);
    }

    if (state.contactFilter !== 'all') {
      const val = Number(state.contactFilter);
      result = result.filter(c => c.contacts.length === val);
    }

    if (state.dofFilter !== 'all') {
      const val = Number(state.dofFilter);
      result = result.filter(c => c.dof === val);
    }

    const compareIds = (idA: string | undefined | null, idB: string | undefined | null): number => {
      const valA = idA || '';
      const valB = idB || '';
      const partsA = valA.split('_');
      const partsB = valB.split('_');
      const numA = partsA.length > 1 ? Number(partsA[1]) : 0;
      const numB = partsB.length > 1 ? Number(partsB[1]) : 0;
      if (isNaN(numA) || isNaN(numB)) {
        return valA.localeCompare(valB);
      }
      return numA - numB;
    };

    result.sort((a, b) => {
      if (state.sortBy === 'disks-asc') return a.disksCount - b.disksCount || compareIds(a.id, b.id);
      if (state.sortBy === 'disks-desc') return b.disksCount - a.disksCount || compareIds(a.id, b.id);
      if (state.sortBy === 'contacts-asc') return a.contacts.length - b.contacts.length || compareIds(a.id, b.id);
      if (state.sortBy === 'contacts-desc') return b.contacts.length - a.contacts.length || compareIds(a.id, b.id);
      if (state.sortBy === 'dof-asc') return a.dof - b.dof || compareIds(a.id, b.id);
      if (state.sortBy === 'dof-desc') return b.dof - a.dof || compareIds(a.id, b.id);
      return 0;
    });

    return result;
  },
  
  addLoadedFile: (file) => 
    set((state) => ({ loadedFiles: [...state.loadedFiles, file] })),
    
  setSelectedClass: (cls) => 
    set({ 
      selectedClass: cls, 
      activeWorkspace: cls ? cloneParsedContactClass(cls) : null,
      pinnedDisks: new Set(),
      selectedDisks: new Set(),
      perimeterHistory: [],
      undoStacks: {},
      redoStacks: {},
      rollingRules: [],
      isRolling: false
    }),
    
  setActiveWorkspace: (cls) =>
    set({ activeWorkspace: cls }),
    
  updateWorkspaceCenters: (centers) =>
    set((state) => {
      if (!state.activeWorkspace) return {};
      const isParsed = centers.length > 0 && typeof centers[0][0] === 'object';
      let wrapped: [ParsedCoordinate, ParsedCoordinate][];
      if (isParsed) {
        wrapped = (centers as [ParsedCoordinate, ParsedCoordinate][]).map(([x, y]) => [
          { floatValue: x.floatValue, symbolicAst: x.symbolicAst.clone(), _evaluatedBig: x._evaluatedBig },
          { floatValue: y.floatValue, symbolicAst: y.symbolicAst.clone(), _evaluatedBig: y._evaluatedBig }
        ]);
      } else {
        wrapped = (centers as [number, number][]).map(([x, y]) => [
          { floatValue: x, symbolicAst: math.parse(x.toString()), _evaluatedBig: math.bignumber(x) },
          { floatValue: y, symbolicAst: math.parse(y.toString()), _evaluatedBig: math.bignumber(y) }
        ]);
      }
      return {
        activeWorkspace: { ...state.activeWorkspace, centers: wrapped }
      };
    }),

  togglePin: (idx) =>
    set((state) => {
      const next = new Set(state.pinnedDisks);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return { pinnedDisks: next };
    }),

  pushPerimeterHistory: (p) =>
    set((state) => {
      const next = [...state.perimeterHistory, p];
      if (next.length > 1000) next.shift();
      return { perimeterHistory: next };
    }),

  clearPerimeterHistory: () =>
    set({ perimeterHistory: [] }),
    
  addWarnings: (warnings) =>
    set((state) => ({ warnings: [...state.warnings, ...warnings] })),
    
  addErrors: (errors) =>
    set((state) => ({ errors: [...state.errors, ...errors] })),
    
  clearErrors: () => set({ errors: [] }),
  clearWarnings: () => set({ warnings: [] }),
  
  reset: () => set({ loadedFiles: [], selectedClass: null, warnings: [], errors: [], criticalityTolerance: 1e-6, stopOnCritical: false }),
  setCriticalityTolerance: (tolerance) => set({ criticalityTolerance: tolerance }),
  setStopOnCritical: (stop) => set({ stopOnCritical: stop }),
  restoreOriginalWorkspace: () => set((state) => {
    if (!state.selectedClass) return state;
    return {
      activeWorkspace: cloneParsedContactClass(state.selectedClass),
      perimeterHistory: [],
      selectedDisks: new Set(),
      undoStacks: {},
      redoStacks: {}
    };
  }),
  
  toggleSelectDisk: (idx, isShift) =>
    set((state) => {
      const next = new Set(state.selectedDisks);
      if (isShift) {
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
      } else {
        next.clear();
        next.add(idx);
      }
      return { selectedDisks: next };
    }),
  clearSelectedDisks: () => set({ selectedDisks: new Set() }),
  
  snapshotDisk: (idx) =>
    set((state) => {
      if (!state.activeWorkspace) return state;
      const prevCoord = state.activeWorkspace.centers[idx];
      const prevFloat: [number, number] = [prevCoord[0].floatValue, prevCoord[1].floatValue];
      const currentStack = state.undoStacks[idx] || [];
      
      if (
        currentStack.length === 0 ||
        currentStack[currentStack.length - 1][0] !== prevFloat[0] ||
        currentStack[currentStack.length - 1][1] !== prevFloat[1]
      ) {
        const updatedStack = [...currentStack, prevFloat];
        if (updatedStack.length > 100) updatedStack.shift();
        
        return {
          undoStacks: { ...state.undoStacks, [idx]: updatedStack },
          redoStacks: { ...state.redoStacks, [idx]: [] }
        };
      }
      return state;
    }),

  undoDisk: (idx) =>
    set((state) => {
      if (!state.activeWorkspace) return state;
      const currentUndo = state.undoStacks[idx] || [];
      if (currentUndo.length === 0) return state;

      const previousCoord = currentUndo[currentUndo.length - 1];
      const nextUndo = currentUndo.slice(0, -1);
      
      const currentCoord = state.activeWorkspace.centers[idx];
      const currentFloat: [number, number] = [currentCoord[0].floatValue, currentCoord[1].floatValue];
      const currentRedo = state.redoStacks[idx] || [];
      const nextRedo = [...currentRedo, currentFloat];
      if (nextRedo.length > 100) nextRedo.shift();

      const newCenters = [...state.activeWorkspace.centers];
      newCenters[idx] = [
        { floatValue: previousCoord[0], symbolicAst: math.parse(previousCoord[0].toString()), _evaluatedBig: math.bignumber(previousCoord[0]) },
        { floatValue: previousCoord[1], symbolicAst: math.parse(previousCoord[1].toString()), _evaluatedBig: math.bignumber(previousCoord[1]) }
      ];

      return {
        activeWorkspace: { ...state.activeWorkspace, centers: newCenters },
        undoStacks: { ...state.undoStacks, [idx]: nextUndo },
        redoStacks: { ...state.redoStacks, [idx]: nextRedo }
      };
    }),

  redoDisk: (idx) =>
    set((state) => {
      if (!state.activeWorkspace) return state;
      const currentRedo = state.redoStacks[idx] || [];
      if (currentRedo.length === 0) return state;

      const nextCoord = currentRedo[currentRedo.length - 1];
      const nextRedo = currentRedo.slice(0, -1);

      const currentCoord = state.activeWorkspace.centers[idx];
      const currentFloat: [number, number] = [currentCoord[0].floatValue, currentCoord[1].floatValue];
      const currentUndo = state.undoStacks[idx] || [];
      const nextUndo = [...currentUndo, currentFloat];
      if (nextUndo.length > 100) nextUndo.shift();

      const newCenters = [...state.activeWorkspace.centers];
      newCenters[idx] = [
        { floatValue: nextCoord[0], symbolicAst: math.parse(nextCoord[0].toString()), _evaluatedBig: math.bignumber(nextCoord[0]) },
        { floatValue: nextCoord[1], symbolicAst: math.parse(nextCoord[1].toString()), _evaluatedBig: math.bignumber(nextCoord[1]) }
      ];

      return {
        activeWorkspace: { ...state.activeWorkspace, centers: newCenters },
        undoStacks: { ...state.undoStacks, [idx]: nextUndo },
        redoStacks: { ...state.redoStacks, [idx]: nextRedo }
      };
    }),

  restoreDisk: (idx) =>
    set((state) => {
      if (!state.activeWorkspace || !state.selectedClass) return state;
      const originalCoord = state.selectedClass.centers[idx];
      const currentCoord = state.activeWorkspace.centers[idx];

      if (
        currentCoord[0].floatValue !== originalCoord[0].floatValue || 
        currentCoord[1].floatValue !== originalCoord[1].floatValue
      ) {
        const currentUndo = state.undoStacks[idx] || [];
        const currentFloat: [number, number] = [currentCoord[0].floatValue, currentCoord[1].floatValue];
        const nextUndo = [...currentUndo, currentFloat];
        if (nextUndo.length > 100) nextUndo.shift();

        const newCenters = [...state.activeWorkspace.centers];
        newCenters[idx] = originalCoord;

        return {
          activeWorkspace: { ...state.activeWorkspace, centers: newCenters },
          undoStacks: { ...state.undoStacks, [idx]: nextUndo },
          redoStacks: { ...state.redoStacks, [idx]: [] }
        };
      }
      return state;
    }),
  
  addRollingRule: () => set((state) => ({
    rollingRules: [...state.rollingRules, {
      id: Math.random().toString(36).substring(2, 9),
      rollingDiskIdx: null,
      pivotDiskIdx: null,
      speed: 1.0,
      direction: 1,
      isActive: true
    }]
  })),
  updateRollingRule: (id, updates) => set((state) => ({
    rollingRules: state.rollingRules.map(rule => rule.id === id ? { ...rule, ...updates } : rule)
  })),
  removeRollingRule: (id) => set((state) => ({
    rollingRules: state.rollingRules.filter(rule => rule.id !== id)
  })),
  clearRollingRules: () => set({ rollingRules: [] }),
  setIsRolling: (isRolling) => set({ isRolling }),
  stepRoll: () => set((state) => ({ rollTrigger: state.rollTrigger + 1 })),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  isAnalysisMode: false,
  toggleAnalysisMode: () => set((state) => ({ isAnalysisMode: !state.isAnalysisMode })),
  goToNextConfig: () => {
    const filtered = get().getFilteredClasses();
    if (filtered.length <= 1) return;
    const selected = get().selectedClass;
    if (!selected) return;
    const idx = filtered.findIndex(c => c.id === selected.id);
    if (idx === -1) return;
    const nextIdx = (idx + 1) % filtered.length;
    get().setSelectedClass(filtered[nextIdx]);
  },
  goToPrevConfig: () => {
    const filtered = get().getFilteredClasses();
    if (filtered.length <= 1) return;
    const selected = get().selectedClass;
    if (!selected) return;
    const idx = filtered.findIndex(c => c.id === selected.id);
    if (idx === -1) return;
    const prevIdx = (idx - 1 + filtered.length) % filtered.length;
    get().setSelectedClass(filtered[prevIdx]);
  }
}));
