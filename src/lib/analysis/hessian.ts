import { Matrix, SVD, EigenvalueDecomposition } from 'ml-matrix';
import { Configuration, HessianResult } from './types';
import { convexHullIndices, isCollinearBig, perimeterGradient } from './perimeter';
import { buildContactMatrix } from './constraints';
import { math } from '../math';
import { getEvaluatedBig } from '../parser';

export function computeEdgeBlockBig(t: [any, any], dist: any): any[][] {
  const tx = t[0], ty = t[1];
  const one = math.bignumber(1) as any;
  const b00 = math.divide(math.subtract(one, math.multiply(tx, tx) as any) as any, dist) as any;
  const b01 = math.divide(math.multiply(math.unaryMinus(tx) as any, ty) as any, dist) as any;
  const b10 = b01;
  const b11 = math.divide(math.subtract(one, math.multiply(ty, ty) as any) as any, dist) as any;
  return [
    [b00, b01],
    [b10, b11]
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
  const hull = convexHullIndices(config.symbolicPositions);

  if (isCollinearBig(config.symbolicPositions)) {
    let maxDist = math.bignumber(0) as any, endA = hull[0], endB = hull[1];
    for (let i = 0; i < hull.length; i++) {
      for (let j = i + 1; j < hull.length; j++) {
        const pi = config.symbolicPositions[hull[i]];
        const pj = config.symbolicPositions[hull[j]];
        const dx = math.subtract(getEvaluatedBig(pj[0]), getEvaluatedBig(pi[0])) as any;
        const dy = math.subtract(getEvaluatedBig(pj[1]), getEvaluatedBig(pi[1])) as any;
        const d = math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any) as any;
        if (math.larger(d, maxDist) as any) {
          maxDist = d;
          endA = hull[i];
          endB = hull[j];
        }
      }
    }

    if (math.larger(maxDist, math.bignumber(1e-15) as any) as any) {
      const dx = math.subtract(getEvaluatedBig(config.symbolicPositions[endB][0]), getEvaluatedBig(config.symbolicPositions[endA][0])) as any;
      const dy = math.subtract(getEvaluatedBig(config.symbolicPositions[endB][1]), getEvaluatedBig(config.symbolicPositions[endA][1])) as any;
      const t: [any, any] = [math.divide(dx, maxDist) as any, math.divide(dy, maxDist) as any];
      const blockBig = computeEdgeBlockBig(t, maxDist);
      const scaledBlock = blockBig.map(r => r.map(v => math.multiply(math.bignumber(2) as any, v) as any));
      const floatBlock = scaledBlock.map(r => r.map(v => typeof v === 'object' && v && 'toNumber' in v ? v.toNumber() : Number(v)));
      
      addBlock(H, floatBlock, endA, endA, 1);
      addBlock(H, floatBlock, endB, endB, 1);
      addBlock(H, floatBlock, endA, endB, -1);
      addBlock(H, floatBlock, endB, endA, -1);
    }
    return H;
  }

  for (let k = 0; k < hull.length; k++) {
    const u = hull[k];
    const v = hull[(k + 1) % hull.length];
    const dx = math.subtract(getEvaluatedBig(config.symbolicPositions[v][0]), getEvaluatedBig(config.symbolicPositions[u][0])) as any;
    const dy = math.subtract(getEvaluatedBig(config.symbolicPositions[v][1]), getEvaluatedBig(config.symbolicPositions[u][1])) as any;
    const dist = math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any) as any;
    if (math.smaller(dist, math.bignumber(1e-15) as any) as any) continue;

    const t: [any, any] = [math.divide(dx, dist) as any, math.divide(dy, dist) as any];
    const blockBig = computeEdgeBlockBig(t, dist);
    const floatBlock = blockBig.map(r => r.map(v => typeof v === 'object' && v && 'toNumber' in v ? v.toNumber() : Number(v)));
    
    addBlock(H, floatBlock, u, u, 1);
    addBlock(H, floatBlock, v, v, 1);
    addBlock(H, floatBlock, u, v, -1);
    addBlock(H, floatBlock, v, u, -1);
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
    const pi = config.symbolicPositions[i];
    const pj = config.symbolicPositions[j];
    const dx = math.subtract(getEvaluatedBig(pj[0]), getEvaluatedBig(pi[0])) as any;
    const dy = math.subtract(getEvaluatedBig(pj[1]), getEvaluatedBig(pi[1])) as any;
    const dist = math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any) as any;
    if (math.smaller(dist, math.bignumber(1e-15) as any) as any) return;

    const ux = math.divide(dx, dist) as any;
    const uy = math.divide(dy, dist) as any;
    const lam = lambdas[idx] || 0.0;
    const lamBig = math.bignumber(lam) as any;

    const factor = math.divide(math.unaryMinus(lamBig) as any, math.bignumber(2.0) as any) as any;
    const one = math.bignumber(1) as any;
    const b00 = math.multiply(factor, math.subtract(one, math.multiply(ux, ux) as any) as any) as any;
    const b01 = math.multiply(factor, math.multiply(math.unaryMinus(ux) as any, uy) as any) as any;
    const b10 = b01;
    const b11 = math.multiply(factor, math.subtract(one, math.multiply(uy, uy) as any) as any) as any;

    const blockBig = [
      [b00, b01],
      [b10, b11]
    ];
    const floatBlock = blockBig.map(r => r.map(v => typeof v === 'object' && v && 'toNumber' in v ? v.toNumber() : Number(v)));

    addBlock(H, floatBlock, i, i, 1);
    addBlock(H, floatBlock, j, j, 1);
    addBlock(H, floatBlock, i, j, -1);
    addBlock(H, floatBlock, j, i, -1);
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
