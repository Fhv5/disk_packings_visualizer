import { SVD } from 'ml-matrix';
import { Configuration, PerimeterResult, Point } from './types';
import { ParsedCoordinate } from '../types';
import { math } from '../math';
import { getEvaluatedBig } from '../parser';

/**
 * Compute the 2D convex hull using Andrew's monotone chain algorithm.
 * Returns indices of hull points in counter-clockwise order.
 * Uses exact BigNumber arithmetic.
 */
export function convexHullIndices(points: [ParsedCoordinate, ParsedCoordinate][]): number[] {
  const n = points.length;
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);

  const indexed = points.map((p, i) => {
    const xBig = getEvaluatedBig(p[0]);
    const yBig = getEvaluatedBig(p[1]);
    return { x: xBig, y: yBig, i };
  });

  indexed.sort((a, b) => {
    if (math.equal(a.x, b.x) as any) {
      return (math.smaller(a.y, b.y) as any) ? -1 : (math.larger(a.y, b.y) as any) ? 1 : 0;
    }
    return (math.smaller(a.x, b.x) as any) ? -1 : 1;
  });

  const cross = (o: typeof indexed[0], a: typeof indexed[0], b: typeof indexed[0]) => {
    const ax_ox = math.subtract(a.x, o.x) as any;
    const by_oy = math.subtract(b.y, o.y) as any;
    const ay_oy = math.subtract(a.y, o.y) as any;
    const bx_ox = math.subtract(b.x, o.x) as any;
    return math.subtract(math.multiply(ax_ox, by_oy) as any, math.multiply(ay_oy, bx_ox) as any) as any;
  };

  const lower: typeof indexed[] = [];
  for (const p of indexed) {
    while (lower.length >= 2 && (math.smaller(cross(lower[lower.length - 2] as any, lower[lower.length - 1] as any, p), 0) as any)) {
      lower.pop();
    }
    lower.push(p as any);
  }

  const upper: typeof indexed[] = [];
  for (let i = indexed.length - 1; i >= 0; i--) {
    const p = indexed[i];
    while (upper.length >= 2 && (math.smaller(cross(upper[upper.length - 2] as any, upper[upper.length - 1] as any, p), 0) as any)) {
      upper.pop();
    }
    upper.push(p as any);
  }

  lower.pop();
  upper.pop();

  const hullIndices = [...lower, ...upper].map(p => (p as any).i);
  return Array.from(new Set(hullIndices));
}

/**
 * Check if ALL points are collinear using exact BigNumber arithmetic.
 */
export function isCollinearBig(points: [ParsedCoordinate, ParsedCoordinate][]): boolean {
  const n = points.length;
  if (n < 3) return true;

  const o = { x: getEvaluatedBig(points[0][0]), y: getEvaluatedBig(points[0][1]) };
  
  // Find a second point not coincident with the first
  let aIdx = 1;
  while (aIdx < n && (math.equal(o.x, getEvaluatedBig(points[aIdx][0])) as any) && (math.equal(o.y, getEvaluatedBig(points[aIdx][1])) as any)) {
    aIdx++;
  }
  if (aIdx === n) return true; // all points are coincident

  const refA = { x: getEvaluatedBig(points[aIdx][0]), y: getEvaluatedBig(points[aIdx][1]) };

  const cross = (p: typeof o) => {
    const ax_ox = math.subtract(refA.x, o.x) as any;
    const py_oy = math.subtract(p.y, o.y) as any;
    const ay_oy = math.subtract(refA.y, o.y) as any;
    const px_ox = math.subtract(p.x, o.x) as any;
    return math.subtract(math.multiply(ax_ox, py_oy) as any, math.multiply(ay_oy, px_ox) as any) as any;
  };

  const BIG_TOLERANCE = math.bignumber(1e-12) as any;

  for (let i = 0; i < n; i++) {
    const p = { x: getEvaluatedBig(points[i][0]), y: getEvaluatedBig(points[i][1]) };
    const c = math.abs(cross(p) as any) as any;
    if (math.larger(c, BIG_TOLERANCE) as any) {
      return false;
    }
  }

  return true;
}

export function exactPerimeter(symbolicPositions: [ParsedCoordinate, ParsedCoordinate][], r: number = 1.0): any {
  const hull = convexHullIndices(symbolicPositions);

  if (hull.length <= 1) {
    return math.multiply(math.multiply(math.bignumber(2) as any, math.pi) as any, math.bignumber(r) as any);
  }

  let centersPerimBig: any;

  if (isCollinearBig(symbolicPositions)) {
    let maxDist = math.bignumber(0) as any;
    for (let i = 0; i < hull.length; i++) {
      for (let j = i + 1; j < hull.length; j++) {
        const pi = symbolicPositions[hull[i]];
        const pj = symbolicPositions[hull[j]];
        const dx = math.subtract(getEvaluatedBig(pj[0]), getEvaluatedBig(pi[0])) as any;
        const dy = math.subtract(getEvaluatedBig(pj[1]), getEvaluatedBig(pi[1])) as any;
        const d = math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any) as any;
        if (math.larger(d, maxDist) as any) {
          maxDist = d;
        }
      }
    }
    centersPerimBig = math.multiply(math.bignumber(2) as any, maxDist);
  } else {
    let perimeter = math.bignumber(0) as any;
    for (let i = 0; i < hull.length; i++) {
      const j = (i + 1) % hull.length;
      const pi = symbolicPositions[hull[i]];
      const pj = symbolicPositions[hull[j]];
      const dx = math.subtract(getEvaluatedBig(pj[0]), getEvaluatedBig(pi[0])) as any;
      const dy = math.subtract(getEvaluatedBig(pj[1]), getEvaluatedBig(pi[1])) as any;
      const d = math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any) as any;
      perimeter = math.add(perimeter, d) as any;
    }
    centersPerimBig = perimeter;
  }

  const rBig = math.bignumber(r) as any;
  const finalP = math.add(centersPerimBig, math.multiply(math.multiply(math.bignumber(2) as any, math.pi) as any, rBig) as any) as any;
  return finalP;
}

export function perimeterOfCenters(config: Configuration): any {
  const hull = convexHullIndices(config.symbolicPositions);

  if (hull.length <= 1) return math.bignumber(0);

  if (isCollinearBig(config.symbolicPositions)) {
    let maxDist = math.bignumber(0) as any;
    for (let i = 0; i < hull.length; i++) {
      for (let j = i + 1; j < hull.length; j++) {
        const pi = config.symbolicPositions[hull[i]];
        const pj = config.symbolicPositions[hull[j]];
        const dx = math.subtract(getEvaluatedBig(pj[0]), getEvaluatedBig(pi[0])) as any;
        const dy = math.subtract(getEvaluatedBig(pj[1]), getEvaluatedBig(pi[1])) as any;
        const d = math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any) as any;
        if (math.larger(d, maxDist) as any) {
          maxDist = d;
        }
      }
    }
    return math.multiply(math.bignumber(2) as any, maxDist) as any;
  }

  let perimeter = math.bignumber(0) as any;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const pi = config.symbolicPositions[hull[i]];
    const pj = config.symbolicPositions[hull[j]];
    const dx = math.subtract(getEvaluatedBig(pj[0]), getEvaluatedBig(pi[0])) as any;
    const dy = math.subtract(getEvaluatedBig(pj[1]), getEvaluatedBig(pi[1])) as any;
    const d = math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any) as any;
    perimeter = math.add(perimeter, d) as any;
  }

  return perimeter;
}

export function perimeterOfDisks(config: Configuration): any {
  return exactPerimeter(config.symbolicPositions, config.radii[0] || 1.0);
}

export function perimeterGradient(config: Configuration): number[] {
  const { n, symbolicPositions } = config;
  const grad = new Array(2 * n).fill(0);
  const hull = convexHullIndices(symbolicPositions);

  if (hull.length <= 1) return grad;

  if (isCollinearBig(symbolicPositions)) {
    let maxDist = math.bignumber(0) as any;
    let endA = 0, endB = 0;

    for (let i = 0; i < hull.length; i++) {
      for (let j = i + 1; j < hull.length; j++) {
        const pi = symbolicPositions[hull[i]];
        const pj = symbolicPositions[hull[j]];
        const dx = math.subtract(getEvaluatedBig(pj[0]), getEvaluatedBig(pi[0])) as any;
        const dy = math.subtract(getEvaluatedBig(pj[1]), getEvaluatedBig(pi[1])) as any;
        const dSq = math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any;
        if (math.larger(dSq, maxDist) as any) {
          maxDist = dSq;
          endA = hull[i];
          endB = hull[j];
        }
      }
    }

    const dist = math.sqrt(maxDist) as any;
    if (math.smaller(dist, math.bignumber(1e-15) as any) as any) return grad;

    const dx = math.subtract(getEvaluatedBig(symbolicPositions[endB][0]), getEvaluatedBig(symbolicPositions[endA][0])) as any;
    const dy = math.subtract(getEvaluatedBig(symbolicPositions[endB][1]), getEvaluatedBig(symbolicPositions[endA][1])) as any;
    const ux = math.divide(dx, dist) as any;
    const uy = math.divide(dy, dist) as any;

    const uxFloat = typeof ux === 'object' && ux && 'toNumber' in ux ? ux.toNumber() : Number(ux);
    const uyFloat = typeof uy === 'object' && uy && 'toNumber' in uy ? uy.toNumber() : Number(uy);

    grad[2 * endA] -= 2 * uxFloat;
    grad[2 * endA + 1] -= 2 * uyFloat;
    grad[2 * endB] += 2 * uxFloat;
    grad[2 * endB + 1] += 2 * uyFloat;

    return grad;
  }

  for (let k = 0; k < hull.length; k++) {
    const i = hull[k];
    const j = hull[(k + 1) % hull.length];

    const dx = math.subtract(getEvaluatedBig(symbolicPositions[j][0]), getEvaluatedBig(symbolicPositions[i][0])) as any;
    const dy = math.subtract(getEvaluatedBig(symbolicPositions[j][1]), getEvaluatedBig(symbolicPositions[i][1])) as any;
    const dist = math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any) as any;

    if (math.smaller(dist, math.bignumber(1e-15) as any) as any) continue;

    const ux = math.divide(dx, dist) as any;
    const uy = math.divide(dy, dist) as any;

    const uxFloat = typeof ux === 'object' && ux && 'toNumber' in ux ? ux.toNumber() : Number(ux);
    const uyFloat = typeof uy === 'object' && uy && 'toNumber' in uy ? uy.toNumber() : Number(uy);

    grad[2 * i] -= uxFloat;
    grad[2 * i + 1] -= uyFloat;
    grad[2 * j] += uxFloat;
    grad[2 * j + 1] += uyFloat;
  }

  return grad;
}

export function computePerimeter(config: Configuration): PerimeterResult {
  return {
    perimeter: perimeterOfDisks(config),
    gradient: perimeterGradient(config),
  };
}
