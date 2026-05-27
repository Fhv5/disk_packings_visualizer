import { Matrix, SVD, EigenvalueDecomposition } from 'ml-matrix';
import { Configuration, HessianResult } from './types';
import { convexHullIndices, isCollinear, perimeterGradient } from './perimeter';
import { buildContactMatrix } from './constraints';

export function computeEdgeBlock(t: [number, number], dist: number): number[][] {
  const tx = t[0], ty = t[1];
  return [
    [(1 - tx * tx) / dist, (-tx * ty) / dist],
    [(-tx * ty) / dist, (1 - ty * ty) / dist],
  ];
}

export function addBlock(H: number[][], block: number[][], row: number, col: number, sign: number): void {
  H[2 * row][2 * col] += sign * block[0][0];
  H[2 * row][2 * col + 1] += sign * block[0][1];
  H[2 * row + 1][2 * col] += sign * block[1][0];
  H[2 * row + 1][2 * col + 1] += sign * block[1][1];
}

export function buildEuclideanHessian(config: Configuration): number[][] {
  const dim = 2 * config.n;
  const H = Array.from({ length: dim }, () => new Array(dim).fill(0));
  const hull = convexHullIndices(config.positions);

  if (isCollinear(config.positions)) {
    let maxDist = 0, endA = hull[0], endB = hull[1];
    for (let i = 0; i < hull.length; i++) {
      for (let j = i + 1; j < hull.length; j++) {
        const pi = config.positions[hull[i]];
        const pj = config.positions[hull[j]];
        const d = Math.sqrt((pj[0] - pi[0]) ** 2 + (pj[1] - pi[1]) ** 2);
        if (d > maxDist) { maxDist = d; endA = hull[i]; endB = hull[j]; }
      }
    }

    if (maxDist > 1e-15) {
      const dx = config.positions[endB][0] - config.positions[endA][0];
      const dy = config.positions[endB][1] - config.positions[endA][1];
      const t: [number, number] = [dx / maxDist, dy / maxDist];
      const block = computeEdgeBlock(t, maxDist);
      const scaledBlock = block.map(r => r.map(v => 2 * v));
      addBlock(H, scaledBlock, endA, endA, 1);
      addBlock(H, scaledBlock, endB, endB, 1);
      addBlock(H, scaledBlock, endA, endB, -1);
      addBlock(H, scaledBlock, endB, endA, -1);
    }
    return H;
  }

  for (let k = 0; k < hull.length; k++) {
    const u = hull[k];
    const v = hull[(k + 1) % hull.length];
    const dx = config.positions[v][0] - config.positions[u][0];
    const dy = config.positions[v][1] - config.positions[u][1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-15) continue;

    const t: [number, number] = [dx / dist, dy / dist];
    const block = computeEdgeBlock(t, dist);
    addBlock(H, block, u, u, 1);
    addBlock(H, block, v, v, 1);
    addBlock(H, block, u, v, -1);
    addBlock(H, block, v, u, -1);
  }

  return H;
}

/**
 * Solve A^T * lambda = grad via SVD-based least squares.
 */
export function solveLagrangeMultipliers(A: number[][], gradient: number[]): number[] {
  if (A.length === 0) return [];

  const At = new Matrix(A).transpose();
  const b = Matrix.columnVector(gradient);

  const svd = new SVD(At);
  const U = svd.leftSingularVectors;
  const S = svd.diagonal;
  const V = svd.rightSingularVectors;

  const Utb = U.transpose().mmul(b);

  const tol = 1e-10 * Math.max(...S);
  const m = A.length;
  const result = new Array(m).fill(0);

  for (let i = 0; i < Math.min(S.length, m); i++) {
    if (S[i] > tol) {
      const coeff = Utb.get(i, 0) / S[i];
      for (let j = 0; j < m; j++) {
        result[j] += V.get(j, i) * coeff;
      }
    }
  }

  return result;
}

export function buildGeometricHessian(config: Configuration, lambdas: number[]): number[][] {
  const dim = 2 * config.n;
  const H = Array.from({ length: dim }, () => new Array(dim).fill(0));

  config.contacts.forEach(([i, j], idx) => {
    const dx = config.positions[j][0] - config.positions[i][0];
    const dy = config.positions[j][1] - config.positions[i][1];
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1e-15) return;

    const ux = dx / dist;
    const uy = dy / dist;
    const lam = lambdas[idx] || 0.0;

    const factor = -lam / 2.0;
    const block = [
      [factor * (1 - ux * ux), factor * (-ux * uy)],
      [factor * (-ux * uy), factor * (1 - uy * uy)],
    ];

    addBlock(H, block, i, i, 1);
    addBlock(H, block, j, j, 1);
    addBlock(H, block, i, j, -1);
    addBlock(H, block, j, i, -1);
  });

  return H;
}

export function projectToRoll(HAmbient: number[][], R: number[][]): number[][] {
  const matH = new Matrix(HAmbient);
  const matR = new Matrix(R);
  const Rt = matR.transpose();
  const result = Rt.mmul(matH).mmul(matR);
  return result.to2DArray();
}

export function symmetrize(H: number[][]): number[][] {
  const n = H.length;
  const S = Array.from({ length: n }, (_, i) =>
    new Array(n).fill(0).map((_, j) => (H[i][j] + (H[j] ? H[j][i] : 0)) / 2)
  );
  return S;
}

/**
 * Compute eigenvalues of a symmetric matrix using ml-matrix's EigenvalueDecomposition.
 */
export function intrinsicSpectrum(
  H: number[][],
  tolerance: number = 1e-10
): { eigenvalues: number[]; eigenvectors: number[][] } {
  if (H.length === 0 || H[0].length === 0) {
    return { eigenvalues: [], eigenvectors: [] };
  }
  const sym = symmetrize(H);
  const mat = new Matrix(sym);

  const eig = new EigenvalueDecomposition(mat);
  let eigenvalues = eig.realEigenvalues;
  const eigVecMatrix = eig.eigenvectorMatrix;

  // Clean noise
  eigenvalues = eigenvalues.map((v) => (Math.abs(v) < tolerance ? 0 : v));

  // Sort ascending
  const indices = eigenvalues.map((_, i) => i);
  indices.sort((a, b) => eigenvalues[a] - eigenvalues[b]);

  const sortedValues = indices.map((i) => eigenvalues[i]);

  const sortedVectors: number[][] = indices.map((i) => {
    const col: number[] = [];
    for (let row = 0; row < eigVecMatrix.rows; row++) {
      col.push(eigVecMatrix.get(row, i));
    }
    return col;
  });

  return { eigenvalues: sortedValues, eigenvectors: sortedVectors };
}

export function computeHessian(
  config: Configuration,
  R: number[][]
): HessianResult {
  const dim = 2 * config.n;
  const HEucl = buildEuclideanHessian(config);
  const A = buildContactMatrix(config);
  const grad = perimeterGradient(config);

  const lambdas = solveLagrangeMultipliers(A, grad);
  const HGeom = buildGeometricHessian(config, lambdas);

  const HTotal = Array.from({ length: dim }, (_, i) =>
    new Array(dim).fill(0).map((_, j) => (HEucl[i] ? HEucl[i][j] : 0) + (HGeom[i] ? HGeom[i][j] : 0))
  );

  const HRoll = projectToRoll(HTotal, R);

  // Validate: replace non-finite values
  for (let i = 0; i < HRoll.length; i++) {
    for (let j = 0; j < HRoll[i].length; j++) {
      if (!isFinite(HRoll[i][j])) {
        HRoll[i][j] = 0;
      }
    }
  }

  const { eigenvalues, eigenvectors } = intrinsicSpectrum(HRoll);

  const negativeTolerance = 1e-6;
  const isLocalMinimum = eigenvalues.length > 0 && eigenvalues.every((v) => v >= -negativeTolerance);

  return {
    euclideanHessian: HEucl,
    geometricHessian: HGeom,
    totalAmbientHessian: HTotal,
    lagrangeMultipliers: lambdas,
    intrinsicHessian: HRoll,
    eigenvalues,
    eigenvectors,
    isLocalMinimum,
  };
}
