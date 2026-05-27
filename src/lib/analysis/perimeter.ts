import { SVD } from 'ml-matrix';
import { Configuration, PerimeterResult, Point } from './types';

/**
 * Compute the 2D convex hull using Andrew's monotone chain algorithm.
 * Returns indices of hull points in counter-clockwise order.
 * CRITICAL: Uses ε = 1e-12 to preserve collinear boundary points.
 */
export function convexHullIndices(points: Point[]): number[] {
  const n = points.length;
  if (n <= 1) return Array.from({ length: n }, (_, i) => i);

  const indexed = points.map((p, i) => ({ x: p[0], y: p[1], i }));
  indexed.sort((a, b) => a.x - b.x || a.y - b.y);

  const cross = (o: typeof indexed[0], a: typeof indexed[0], b: typeof indexed[0]) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const EPS = 1e-12;

  const lower: typeof indexed = [];
  for (const p of indexed) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) < -EPS) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: typeof indexed = [];
  for (let i = indexed.length - 1; i >= 0; i--) {
    const p = indexed[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) < -EPS) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();

  const hullIndices = [...lower, ...upper].map(p => p.i);
  return Array.from(new Set(hullIndices));
}

/**
 * Check if ALL points are collinear using SVD.
 */
export function isCollinear(points: Point[]): boolean {
  const n = points.length;
  if (n < 3) return true;

  let meanX = 0, meanY = 0;
  for (const p of points) { meanX += p[0]; meanY += p[1]; }
  meanX /= n; meanY /= n;

  const centered = points.map(p => [p[0] - meanX, p[1] - meanY]);

  const A = new SVD(centered);
  const s = A.diagonal;

  return s[1] < 1e-8;
}

export function perimeterOfCenters(config: Configuration): number {
  const hull = convexHullIndices(config.positions);

  if (hull.length <= 1) return 0;

  if (isCollinear(config.positions)) {
    let maxDist = 0;
    for (let i = 0; i < hull.length; i++) {
      for (let j = i + 1; j < hull.length; j++) {
        const pi = config.positions[hull[i]];
        const pj = config.positions[hull[j]];
        const d = Math.sqrt((pj[0] - pi[0]) ** 2 + (pj[1] - pi[1]) ** 2);
        maxDist = Math.max(maxDist, d);
      }
    }
    return 2 * maxDist;
  }

  let perimeter = 0;
  for (let i = 0; i < hull.length; i++) {
    const j = (i + 1) % hull.length;
    const pi = config.positions[hull[i]];
    const pj = config.positions[hull[j]];
    perimeter += Math.sqrt((pj[0] - pi[0]) ** 2 + (pj[1] - pi[1]) ** 2);
  }

  return perimeter;
}

export function perimeterOfDisks(config: Configuration): number {
  const r = config.radii[0] || 1.0;
  const centersPerim = perimeterOfCenters(config);
  return centersPerim + 2 * Math.PI * r;
}

export function perimeterGradient(config: Configuration): number[] {
  const { n, positions } = config;
  const grad = new Array(2 * n).fill(0);
  const hull = convexHullIndices(positions);

  if (hull.length <= 1) return grad;

  if (isCollinear(positions)) {
    let maxDist = 0;
    let endA = 0, endB = 0;

    for (let i = 0; i < hull.length; i++) {
      for (let j = i + 1; j < hull.length; j++) {
        const pi = positions[hull[i]];
        const pj = positions[hull[j]];
        const dSq = (pj[0] - pi[0]) ** 2 + (pj[1] - pi[1]) ** 2;
        if (dSq > maxDist) {
          maxDist = dSq;
          endA = hull[i];
          endB = hull[j];
        }
      }
    }

    const dist = Math.sqrt(maxDist);
    if (dist < 1e-15) return grad;

    const dx = positions[endB][0] - positions[endA][0];
    const dy = positions[endB][1] - positions[endA][1];
    const ux = dx / dist;
    const uy = dy / dist;

    grad[2 * endA] -= 2 * ux;
    grad[2 * endA + 1] -= 2 * uy;
    grad[2 * endB] += 2 * ux;
    grad[2 * endB + 1] += 2 * uy;

    return grad;
  }

  for (let k = 0; k < hull.length; k++) {
    const i = hull[k];
    const j = hull[(k + 1) % hull.length];

    const dx = positions[j][0] - positions[i][0];
    const dy = positions[j][1] - positions[i][1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1e-15) continue;

    const ux = dx / dist;
    const uy = dy / dist;

    grad[2 * i] -= ux;
    grad[2 * i + 1] -= uy;
    grad[2 * j] += ux;
    grad[2 * j + 1] += uy;
  }

  return grad;
}

export function computePerimeter(config: Configuration): PerimeterResult {
  return {
    perimeter: perimeterOfDisks(config),
    gradient: perimeterGradient(config),
  };
}
