import { ParsedContactClass, ParsedCoordinate } from '../types';

export type Point = [number, number];
export type Contact = [number, number];

export interface Configuration {
  n: number;                  // Number of disks
  positions: Point[];         // Center positions (Float64)
  symbolicPositions: [ParsedCoordinate, ParsedCoordinate][]; // Exact coordinates (Symbolic/BigNumber)
  radii: number[];            // Disk radii
  contacts: Contact[];        // Contact pairs
  latticeContacts: Contact[]; // Contacts through lattice translation (unused, keep for CLI API compatibility)
  latticeShifts: Point[];     // Translation vectors for lattice contacts
}

export interface GraphValidation {
  isValid: boolean;
  expectedEdges: number;
  actualEdges: number;
  message: string;
}

export interface ConstraintData {
  contactMatrix: number[][];       // Jacobian of contact constraints (m x 2n)
  rollingMatrix: number[][];       // Rolling space basis (2n x d)
  dimension: number;               // Degrees of freedom (d)
}

export interface PerimeterResult {
  perimeter: any;
  gradient: number[];
}

export interface HessianResult {
  euclideanHessian: number[][];     // H_P (2n x 2n)
  geometricHessian: number[][];     // H_geom (2n x 2n)
  totalAmbientHessian: number[][];  // H_total = H_P + H_geom (2n x 2n)
  lagrangeMultipliers: number[];    // λ vector (m entries)
  intrinsicHessian: number[][];     // H_roll = Z^T H_total Z (d x d)
  eigenvalues: number[];            // Eigenvalues of H_roll
  eigenvectors: number[][];         // Eigenvectors of H_roll
  isLocalMinimum: boolean;
}

export interface AnalysisResult {
  configuration: Configuration;
  graphValidation: GraphValidation;
  constraints: ConstraintData;
  perimeter: PerimeterResult;
  hessian: HessianResult;
  projectedGradient: number[];
  isCritical: boolean;
  perimeterCenters: any;        // Perimeter of centers only (without 2πr)
  summary: string;
}

export function parsedContactClassToConfiguration(cls: ParsedContactClass): Configuration {
  return {
    n: cls.disksCount,
    positions: cls.centers.map(([x, y]) => [x.floatValue, y.floatValue]),
    symbolicPositions: cls.centers.map(([x, y]) => [
      { floatValue: x.floatValue, symbolicAst: x.symbolicAst, _evaluatedBig: x._evaluatedBig },
      { floatValue: y.floatValue, symbolicAst: y.symbolicAst, _evaluatedBig: y._evaluatedBig }
    ]),
    radii: new Array(cls.disksCount).fill(1.0), // All disks are unit disks (radius = 1.0, contact distance = 2.0)
    contacts: cls.contacts.map(([u, v]) => [u, v]),
    latticeContacts: [],
    latticeShifts: []
  };
}
