import { create } from 'zustand';
import { ParsedContactClass, ParsedFile } from './types';
import { parsePackingFile } from './parser';

import data3 from '../../data/3disks.json';
import data4 from '../../data/4disks.json';
import data5 from '../../data/5disks.json';
import data6 from '../../data/6disks.json';

const defaultFiles: ParsedFile[] = [];
try {
  const files = [
    { data: data3, name: '3disks.json' },
    { data: data4, name: '4disks.json' },
    { data: data5, name: '5disks.json' },
    { data: data6, name: '6disks.json' },
  ];
  for (const file of files) {
    const { data } = parsePackingFile(JSON.stringify(file.data), file.name);
    if (data) {
      defaultFiles.push(data);
    }
  }
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

  addLoadedFile: (file: ParsedFile) => void;
  setSelectedClass: (cls: ParsedContactClass | null) => void;
  setActiveWorkspace: (cls: ParsedContactClass | null) => void;
  updateWorkspaceCenters: (centers: [number, number][]) => void;
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
}

export const useAppStore = create<AppState>((set) => ({
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
  
  addLoadedFile: (file) => 
    set((state) => ({ loadedFiles: [...state.loadedFiles, file] })),
    
  setSelectedClass: (cls) => 
    set({ 
      selectedClass: cls, 
      activeWorkspace: cls ? JSON.parse(JSON.stringify(cls)) : null,
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
    set((state) => ({ 
      activeWorkspace: state.activeWorkspace ? { ...state.activeWorkspace, centers } : null 
    })),

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
  
  reset: () => set({ loadedFiles: [], selectedClass: null, warnings: [], errors: [] }),
  restoreOriginalWorkspace: () => set((state) => {
    if (!state.selectedClass) return state;
    return {
      activeWorkspace: JSON.parse(JSON.stringify(state.selectedClass)),
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
      const currentStack = state.undoStacks[idx] || [];
      
      if (
        currentStack.length === 0 ||
        currentStack[currentStack.length - 1][0] !== prevCoord[0] ||
        currentStack[currentStack.length - 1][1] !== prevCoord[1]
      ) {
        const updatedStack = [...currentStack, prevCoord];
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
      const currentRedo = state.redoStacks[idx] || [];
      const nextRedo = [...currentRedo, currentCoord];
      if (nextRedo.length > 100) nextRedo.shift();

      const newCenters = [...state.activeWorkspace.centers];
      newCenters[idx] = previousCoord;

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
      const currentUndo = state.undoStacks[idx] || [];
      const nextUndo = [...currentUndo, currentCoord];
      if (nextUndo.length > 100) nextUndo.shift();

      const newCenters = [...state.activeWorkspace.centers];
      newCenters[idx] = nextCoord;

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

      if (currentCoord[0] !== originalCoord[0] || currentCoord[1] !== originalCoord[1]) {
        const currentUndo = state.undoStacks[idx] || [];
        const nextUndo = [...currentUndo, currentCoord];
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
  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }))
}));
