import { analyzeConfiguration } from './analysis/analysis';
import { parsedContactClassToConfiguration } from './analysis/types';
import { convexHull, calculatePerimeter, getSymbolicPerimeter, Point2D } from './geometry';
import { ParsedContactClass } from './types';
import { DEFAULT_CRITICALITY_TOLERANCE } from './config';

export interface PackingExportOptions {
  includeStructure: boolean;
  includeDoF: boolean;
  includeHullVertices: boolean;
  includePerimeter: boolean;
  includeAnalysis: boolean;
}

const numericValue = (value: unknown): number => {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value);
};

export function createPackingExportGraph(
  source: ParsedContactClass,
  options: PackingExportOptions,
  criticalityTolerance: number = DEFAULT_CRITICALITY_TOLERANCE,
): Record<string, unknown> {
  const graph: Record<string, unknown> = {};

  if (options.includeStructure) {
    graph.discos = source.disksCount;
    graph.nombre = source.id;
    graph.centros = source.centers.map((center) => [
      Number(center[0].floatValue.toFixed(15)),
      Number(center[1].floatValue.toFixed(15)),
    ]);
    graph.contactos = source.contacts;
  }

  if (options.includeDoF) graph.dof = source.dof;

  if (options.includeHullVertices || options.includePerimeter) {
    const floatCenters = source.centers.map(([x, y]) => [x.floatValue, y.floatValue]) as Point2D[];
    const hull = convexHull(floatCenters);
    if (options.includeHullVertices) graph.hullVertices = hull.length;
    if (options.includePerimeter) {
      graph.perimeter = {
        numeric: Number(calculatePerimeter(hull).toFixed(15)),
        symbolic: getSymbolicPerimeter(hull),
      };
    }
  }

  if (options.includeAnalysis) {
    const result = analyzeConfiguration(
      parsedContactClassToConfiguration(source),
      criticalityTolerance,
    );
    const configuration = result.configuration;

    graph.analysis = {
      criticalityTolerance,
      configuration: {
        numberOfDisks: configuration.n,
        activeContacts: configuration.contacts.length,
        degreesOfFreedom: 2 * configuration.n - configuration.contacts.length - 3,
        rollingDimension: result.constraints.dimension,
        rigid: result.constraints.dimension <= 3,
        positions: configuration.positions,
        radii: configuration.radii,
        contacts: configuration.contacts,
      },
      graphValidation: result.graphValidation,
      constraints: result.constraints,
      perimeter: {
        centers: numericValue(result.perimeterCenters),
        disks: numericValue(result.perimeter.perimeter),
        gradient: result.perimeter.gradient,
      },
      projectedGradient: result.projectedGradient,
      isCritical: result.isCritical,
      hessian: result.hessian,
    };
  }

  return graph;
}
