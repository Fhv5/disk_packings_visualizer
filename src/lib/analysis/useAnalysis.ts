import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { ParsedContactClass } from '@/lib/types';
import { AnalysisResult, parsedContactClassToConfiguration, analyzeConfiguration } from './index';

// Global cache to persist analysis results across panel open/close
let globalAnalysisCache: {
  workspaceId: string | null;
  centersStr: string;
  tolerance: number;
  data: AnalysisResult | null;
} = {
  workspaceId: null,
  centersStr: '',
  tolerance: 0,
  data: null
};

export function useAnalysis(
  workspace: ParsedContactClass | null,
  isDebounced: boolean = true
) {
  const isRolling = useAppStore(state => state.isRolling);
  const criticalityTolerance = useAppStore(state => state.criticalityTolerance);

  // Stringify only float values for efficient change detection
  const centersStr = workspace
    ? JSON.stringify(workspace.centers.map(([x, y]) => [x.floatValue, y.floatValue]))
    : '';

  const initialData = (workspace && 
                       globalAnalysisCache.workspaceId === workspace.id && 
                       globalAnalysisCache.centersStr === centersStr &&
                       globalAnalysisCache.tolerance === criticalityTolerance)
    ? globalAnalysisCache.data
    : null;

  const [data, setData] = useState<AnalysisResult | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last workspace ID to detect initial load vs updates
  const lastWorkspaceIdRef = useRef<string | null>(workspace?.id || null);
  // Throttle analysis during rolling to avoid overwhelming React
  const lastRollingAnalysisRef = useRef(0);

  useEffect(() => {
    if (!workspace) {
      setData(null);
      setError(null);
      setLoading(false);
      globalAnalysisCache = { workspaceId: null, centersStr: '', tolerance: 0, data: null };
      return;
    }

    let cancelled = false;

    const configIdChanged = lastWorkspaceIdRef.current !== workspace.id;
    lastWorkspaceIdRef.current = workspace.id;

    // If we already have up-to-date cached data for this configuration/positions/tolerance, use it immediately
    if (initialData && !configIdChanged) {
      setLoading(false);
      return;
    }

    // --- During rolling: synchronous computation, no loading state ---
    // This prevents the cascade where setLoading(true) fires every frame
    // but the async computation is always cancelled before setLoading(false)
    if (isRolling) {
      // Throttle: only recompute every ~33ms (30fps) during rolling
      const now = Date.now();
      if (!configIdChanged && now - lastRollingAnalysisRef.current < 33) {
        return () => { cancelled = true; };
      }
      lastRollingAnalysisRef.current = now;

      // Clear loading state (may be stuck from a previous non-rolling computation)
      setLoading(false);

      try {
        const config = parsedContactClassToConfiguration(workspace);
        const result = analyzeConfiguration(config, criticalityTolerance);
        setData(result);
        globalAnalysisCache = {
          workspaceId: workspace.id,
          centersStr,
          tolerance: criticalityTolerance,
          data: result
        };
        setError(null);
      } catch (e: any) {
        setError(e.message || 'Error computing analysis');
      }
      return () => { cancelled = true; };
    }

    // --- Not rolling: async computation with loading indicator ---
    const runComputation = () => {
      setLoading(true);
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (cancelled) return;
          try {
            const config = parsedContactClassToConfiguration(workspace);
            const result = analyzeConfiguration(config, criticalityTolerance);
            if (!cancelled) {
              setData(result);
              globalAnalysisCache = {
                workspaceId: workspace.id,
                centersStr,
                tolerance: criticalityTolerance,
                data: result
              };
              setError(null);
            }
          } catch (e: any) {
            if (!cancelled) {
              setError(e.message || 'Error computing analysis');
            }
          } finally {
            if (!cancelled) {
              setLoading(false);
            }
          }
        }, 0);
      });
    };

    if (configIdChanged || !isDebounced) {
      runComputation();
      return () => { cancelled = true; };
    }

    // Otherwise, debounce the recomputation to avoid lag while dragging (150ms delay)
    const timer = setTimeout(() => {
      runComputation();
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workspace?.id, centersStr, isRolling, isDebounced, initialData, criticalityTolerance]);

  return { data, loading, error };
}
