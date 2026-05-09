import { Point2D } from './geometry';
import { CONTACT_DISTANCE, TOLERANCE } from './parser';

export function solveConstraints(
  centers: Point2D[],
  contacts: [number, number][],
  pinned: Set<number>,
  draggedIdx: number,
  targetPos: Point2D
): Point2D[] | null {
  const n = centers.length;
  let currentCenters: Point2D[] = centers.map(c => [...c] as Point2D);
  currentCenters[draggedIdx] = [...targetPos] as Point2D;

  const MAX_ITER = 50;

  const invMass = new Array(n).fill(1.0);
  for (let i = 0; i < n; i++) {
    if (pinned.has(i)) {
      invMass[i] = 0.0;
    } else if (i === draggedIdx) {
      invMass[i] = 0.0001;
    }
  }

  const adjacency = new Set<string>();
  contacts.forEach(([u, v]) => {
    adjacency.add(u < v ? `${u}-${v}` : `${v}-${u}`);
  });

  for (let iter = 0; iter < MAX_ITER; iter++) {
    let maxError = 0;
    let converged = true;

    for (const [u, v] of contacts) {
      const cu = currentCenters[u];
      const cv = currentCenters[v];
      const dx = cu[0] - cv[0];
      const dy = cu[1] - cv[1];
      const d = Math.sqrt(dx * dx + dy * dy);
      
      if (d === 0) continue; 
      
      const err = d - CONTACT_DISTANCE;
      maxError = Math.max(maxError, Math.abs(err));

      if (Math.abs(err) > TOLERANCE) {
        converged = false;
        
        const wU = invMass[u];
        const wV = invMass[v];
        const wTotal = wU + wV;
        
        if (wTotal === 0) continue;

        const nx = dx / d;
        const ny = dy / d;
        const totalCorrection = CONTACT_DISTANCE - d;

        currentCenters[u][0] += nx * totalCorrection * (wU / wTotal);
        currentCenters[u][1] += ny * totalCorrection * (wU / wTotal);
        currentCenters[v][0] -= nx * totalCorrection * (wV / wTotal);
        currentCenters[v][1] -= ny * totalCorrection * (wV / wTotal);
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const edgeKey = `${i}-${j}`;
        if (adjacency.has(edgeKey)) continue;
        
        const cu = currentCenters[i];
        const cv = currentCenters[j];
        const dx = cu[0] - cv[0];
        const dy = cu[1] - cv[1];
        const d = Math.sqrt(dx * dx + dy * dy);
        
        if (d < CONTACT_DISTANCE - TOLERANCE && d > 0) {
          converged = false;
          maxError = Math.max(maxError, CONTACT_DISTANCE - d);
          
          const wI = invMass[i];
          const wJ = invMass[j];
          const wTotal = wI + wJ;
          
          if (wTotal === 0) continue;
          
          const nx = dx / d;
          const ny = dy / d;
          const totalCorrection = CONTACT_DISTANCE - d;
          
          currentCenters[i][0] += nx * totalCorrection * (wI / wTotal);
          currentCenters[i][1] += ny * totalCorrection * (wI / wTotal);
          currentCenters[j][0] -= nx * totalCorrection * (wJ / wTotal);
          currentCenters[j][1] -= ny * totalCorrection * (wJ / wTotal);
        }
      }
    }

    if (converged) break;
  }

  for (const [u, v] of contacts) {
    const cu = currentCenters[u];
    const cv = currentCenters[v];
    const dx = cu[0] - cv[0];
    const dy = cu[1] - cv[1];
    const d = Math.sqrt(dx * dx + dy * dy);
    if (Math.abs(d - CONTACT_DISTANCE) > TOLERANCE * 10) {
      return null;
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const edgeKey = `${i}-${j}`;
      if (adjacency.has(edgeKey)) continue;
      const cu = currentCenters[i];
      const cv = currentCenters[j];
      const dx = cu[0] - cv[0];
      const dy = cu[1] - cv[1];
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < CONTACT_DISTANCE - TOLERANCE * 10) {
        return null;
      }
    }
  }

  return currentCenters;
}
