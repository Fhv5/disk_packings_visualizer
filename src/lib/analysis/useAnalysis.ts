import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store';
import { ParsedContactClass } from '@/lib/types';
import { AnalysisResult, parsedContactClassToConfiguration, analyzeConfiguration } from './index';

export function useAnalysis(
  workspace: ParsedContactClass | null,
  isDebounced: boolean = true
) {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRolling = useAppStore(state => state.isRolling);

  // Track the last workspace ID to detect initial load vs updates
  const lastWorkspaceIdRef = useRef<string | null>(null);
  // Stringify centers to detect coordinate changes
  const centersStr = workspace ? JSON.stringify(workspace.centers) : '';

  useEffect(() => {
    if (!workspace) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const runComputation = () => {
      setLoading(true);
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (cancelled) return;
          try {
            const config = parsedContactClassToConfiguration(workspace);
            const result = analyzeConfiguration(config);
            if (!cancelled) {
              setData(result);
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

    const configIdChanged = lastWorkspaceIdRef.current !== workspace.id;
    lastWorkspaceIdRef.current = workspace.id;

    // Trigger immediately if:
    // 1. The active configuration just changed
    // 2. We are in rolling/motor animation mode (always on)
    // 3. Debouncing is explicitly disabled (e.g. on the static Analysis page)
    if (configIdChanged || isRolling || !isDebounced) {
      runComputation();
      return;
    }

    // Otherwise, debounce the recomputation to avoid lag while dragging (1.5 seconds delay)
    const timer = setTimeout(() => {
      runComputation();
    }, 1500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [workspace?.id, centersStr, isRolling, isDebounced]);

  return { data, loading, error };
}
