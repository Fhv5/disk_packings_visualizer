export type Point2D = [number, number];

export function cross(o: Point2D, a: Point2D, b: Point2D): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

export function convexHull(points: Point2D[]): Point2D[] {
  const n = points.length;
  if (n <= 2) return [...points];

  const sorted = [...points].sort((a, b) => {
    return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];
  });

  const lower: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) {
      lower.pop();
    }
    lower.push(sorted[i]);
  }

  const upper: Point2D[] = [];
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) {
      upper.pop();
    }
    upper.push(sorted[i]);
  }

  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function calculatePerimeter(hull: Point2D[]): number {
  if (hull.length === 0) return 0;
  if (hull.length === 1) return 2 * Math.PI * 1.0;
  
  let p = 0;
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    p += Math.sqrt(dx * dx + dy * dy);
  }
  
  if (hull.length >= 2) {
    p += 2 * Math.PI * 1.0;
  }
  
  return p;
}

function simplifySqrt(n: number): { coef: number; rad: number } {
  if (n === 0) return { coef: 0, rad: 1 };
  let maxK = 1;
  for (let k = 2; k * k <= n; k++) {
    if (n % (k * k) === 0) {
      maxK = k;
    }
  }
  return { coef: maxK, rad: n / (maxK * maxK) };
}

export function getSymbolicPerimeter(hull: Point2D[]): string | null {
  if (hull.length === 0) return "0";
  if (hull.length === 1) return "2π";
  
  const terms: Record<number, number> = {};
  
  for (let i = 0; i < hull.length; i++) {
    const p1 = hull[i];
    const p2 = hull[(i + 1) % hull.length];
    const dx = p1[0] - p2[0];
    const dy = p1[1] - p2[1];
    
    const l2 = dx * dx + dy * dy;
    const l2Rounded = Math.round(l2);
    
    // If the squared length is not an integer, we can't easily represent it symbolically
    if (Math.abs(l2 - l2Rounded) > 1e-4) {
      return null;
    }
    
    const { coef, rad } = simplifySqrt(l2Rounded);
    if (!terms[rad]) terms[rad] = 0;
    terms[rad] += coef;
  }
  
  let result = "";
  const radicals = Object.keys(terms).map(Number).sort((a, b) => a - b);
  
  for (const rad of radicals) {
    const coef = terms[rad];
    if (coef === 0) continue;
    
    let termStr = "";
    if (rad === 1) {
      termStr = `${coef}`;
    } else {
      termStr = `${coef === 1 ? "" : coef}√${rad}`;
    }
    
    if (result) result += " + ";
    result += termStr;
  }
  
  if (!result) return "2π";
  return `${result} + 2π`;
}

export function getBoundingBox(points: Point2D[]): { minX: number, minY: number, maxX: number, maxY: number } {
  if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  
  return { minX, minY, maxX, maxY };
}
