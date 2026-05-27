import { Matrix, EigenvalueDecomposition } from 'ml-matrix';
import { Configuration, ConstraintData } from './types';

/**
 * Build the contact constraint Jacobian matrix A(c).
 * 
 * For each contact (i, j), we have one row:
 *   row_k = [..., -u_ij_x, -u_ij_y, ..., u_ij_x, u_ij_y, ...]
 * 
 * A(c) ∈ R^{m × 2n}
 */
export function buildContactMatrix(config: Configuration): number[][] {
  const { n, positions, contacts } = config;
  const cols = 2 * n;
  const A: number[][] = [];

  for (const [i, j] of contacts) {
    const row = new Array(cols).fill(0);

    const dx = positions[j][0] - positions[i][0];
    const dy = positions[j][1] - positions[i][1];
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 1e-15) {
      throw new Error(`Disks ${i} and ${j} have coincident centers`);
    }

    const ux = dx / dist;
    const uy = dy / dist;

    row[2 * i] = -ux;
    row[2 * i + 1] = -uy;
    row[2 * j] = ux;
    row[2 * j + 1] = uy;

    A.push(row);
  }

  return A;
}

/**
 * Compute the rolling space basis — ker(A).
 * 
 * We compute the eigendecomposition of A^T A (which is 2n × 2n, symmetric PSD).
 * The eigenvectors with eigenvalue ≈ 0 span the null space of A.
 */
export function rollingSpaceBasis(
  A: number[][],
  tolerance: number = 1e-10
): number[][] {
  if (A.length === 0) {
    // If no contacts, the rolling space is the full 2n-dimensional space.
    // Return the identity matrix of size 2n.
    if (A.length === 0 && A[0] === undefined) {
      return [];
    }
  }

  const rows = A.length;
  const cols = rows > 0 ? A[0].length : 0;
  if (cols === 0) return [];

  const matA = new Matrix(A);
  const AtA = matA.transpose().mmul(matA);

  const eig = new EigenvalueDecomposition(AtA);
  const eigenvalues = eig.realEigenvalues;
  const V = eig.eigenvectorMatrix;

  // Find null space: eigenvectors where eigenvalue ≈ 0
  const nullIndices: number[] = [];
  for (let i = 0; i < eigenvalues.length; i++) {
    if (Math.abs(eigenvalues[i]) < tolerance) {
      nullIndices.push(i);
    }
  }

  if (nullIndices.length === 0) {
    return Array.from({ length: cols }, () => []);
  }

  // Extract columns of V corresponding to null space
  const R: number[][] = [];
  for (let row = 0; row < V.rows; row++) {
    const r: number[] = [];
    for (const colIdx of nullIndices) {
      r.push(V.get(row, colIdx));
    }
    R.push(r);
  }

  return R;
}

export function computeConstraints(config: Configuration): ConstraintData {
  const contactMatrix = buildContactMatrix(config);
  const rollingMatrix = rollingSpaceBasis(contactMatrix);
  const dimension = rollingMatrix.length > 0 ? rollingMatrix[0].length : 0;

  return { contactMatrix, rollingMatrix, dimension };
}
