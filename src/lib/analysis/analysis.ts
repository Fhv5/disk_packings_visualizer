import { Configuration, AnalysisResult } from './types';
import { checkGraphValidity } from './contact-graphs';
import { computeConstraints } from './constraints';
import { computePerimeter, perimeterOfCenters } from './perimeter';
import { computeHessian } from './hessian';

function isCriticalPoint(
  gradient: number[],
  rollingMatrix: number[][],
  tolerance: number = 1e-6
): boolean {
  if (rollingMatrix.length === 0 || rollingMatrix[0].length === 0) {
    return true; // Rigid configurations are trivially critical points
  }

  // projGrad = R^T @ gradient
  const d = rollingMatrix[0].length;
  const dim = gradient.length;
  const projected: number[] = new Array(d).fill(0);

  for (let k = 0; k < d; k++) {
    for (let i = 0; i < dim; i++) {
      projected[k] += rollingMatrix[i][k] * gradient[i];
    }
  }

  return projected.every((v) => Math.abs(v) < tolerance);
}

function computeProjectedGradient(
  gradient: number[],
  rollingMatrix: number[][]
): number[] {
  if (rollingMatrix.length === 0 || rollingMatrix[0].length === 0) {
    return [];
  }

  const d = rollingMatrix[0].length;
  const dim = gradient.length;
  const projected: number[] = new Array(d).fill(0);

  for (let k = 0; k < d; k++) {
    for (let i = 0; i < dim; i++) {
      projected[k] += rollingMatrix[i][k] * (gradient[i] || 0);
    }
  }

  return projected;
}

export function analyzeConfiguration(config: Configuration): AnalysisResult {
  // Step 1: Validate graph
  const graphValidation = checkGraphValidity(config);

  // Step 2: Constraints
  const constraints = computeConstraints(config);

  // Step 3: Perimeter
  const perimeter = computePerimeter(config);

  // Step 4-5: Hessian
  const hessian = computeHessian(config, constraints.rollingMatrix);

  // Step 6: Projected gradient
  const projectedGradient = computeProjectedGradient(
    perimeter.gradient,
    constraints.rollingMatrix
  );
  const isCritical = isCriticalPoint(perimeter.gradient, constraints.rollingMatrix);

  // Step 7: Summary
  const perimCenters = perimeterOfCenters(config);
  const lines: string[] = [
    `Configuration: ${config.n} disks, ${config.contacts.length} contacts`,
    `Graph valid: ${graphValidation.isValid ? 'Yes' : 'No'} — ${graphValidation.message}`,
    `Rolling space dimension: ${constraints.dimension}`,
    `Rigid: ${constraints.dimension <= 3 ? 'Yes' : 'No'}`,
    `Perimeter (centers): ${perimCenters.toFixed(6)}`,
    `Perimeter (disks): ${perimeter.perimeter.toFixed(6)}`,
    `Critical point: ${isCritical ? 'Yes' : 'No'}`,
    `Eigenvalues of intrinsic Hessian:`,
  ];
  for (let i = 0; i < hessian.eigenvalues.length; i++) {
    lines.push(`  λ_${i}: ${hessian.eigenvalues[i].toFixed(6)}`);
  }
  lines.push(`Local minimum: ${hessian.isLocalMinimum ? 'Yes' : 'No'}`);

  const summary = lines.join('\n');

  return {
    configuration: config,
    graphValidation,
    constraints,
    perimeter,
    hessian,
    projectedGradient,
    isCritical,
    perimeterCenters: perimCenters,
    summary,
  };
}
