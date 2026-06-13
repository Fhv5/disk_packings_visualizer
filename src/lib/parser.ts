import { PackingFileJSON, ParsedFile, ParsedContactClass, ParsedCoordinate } from './types';
import { math } from './math';

export const TOLERANCE = 1e-6;
export const CONTACT_DISTANCE = 2.0;

export function evaluateMath(expression: string): number {
  try {
    if (!expression || expression.trim() === '') return NaN;
    const evaluated = math.evaluate(expression);
    
    // Coordinates must be dimensionless scalar numbers (number, BigNumber, Fraction)
    const type = math.typeOf(evaluated);
    if (type !== 'number' && type !== 'BigNumber' && type !== 'Fraction') {
      return NaN;
    }
    
    return typeof evaluated === 'object' && evaluated && 'toNumber' in evaluated 
      ? evaluated.toNumber() 
      : Number(evaluated);
  } catch {
    return NaN;
  }
}

export function parseCoordinate(expression: string | number, scope?: any): ParsedCoordinate {
  if (typeof expression === 'number') {
    return {
      floatValue: expression,
      symbolicAst: math.parse(expression.toString()),
      _evaluatedBig: math.bignumber(expression)
    };
  }
  const sanitized = expression.replace(/\*\*/g, '^');
  const node = math.parse(sanitized);
  const evaluated = node.evaluate(scope);
  
  // Coordinates must be dimensionless scalar numbers (number, BigNumber, Fraction)
  const type = math.typeOf(evaluated);
  if (type !== 'number' && type !== 'BigNumber' && type !== 'Fraction') {
    throw new Error(`Invalid coordinate expression: evaluated to a ${type}`);
  }
  
  const floatValue = typeof evaluated === 'object' && evaluated && 'toNumber' in evaluated 
    ? evaluated.toNumber() 
    : Number(evaluated);
  return {
    floatValue,
    symbolicAst: node,
    _evaluatedBig: evaluated
  };
}

export function getEvaluatedBig(coord: ParsedCoordinate): any {
  if (coord._evaluatedBig !== undefined) {
    return coord._evaluatedBig;
  }
  const val = coord.symbolicAst.evaluate();
  coord._evaluatedBig = val;
  return val;
}

function distanceBigNumber(p1: [ParsedCoordinate, ParsedCoordinate], p2: [ParsedCoordinate, ParsedCoordinate]): any {
  const x1 = getEvaluatedBig(p1[0]);
  const y1 = getEvaluatedBig(p1[1]);
  const x2 = getEvaluatedBig(p2[0]);
  const y2 = getEvaluatedBig(p2[1]);

  const dx = math.subtract(x1, x2) as any;
  const dy = math.subtract(y1, y2) as any;
  
  return math.sqrt(math.add(math.multiply(dx, dx) as any, math.multiply(dy, dy) as any) as any);
}

export function parsePackingFile(jsonStr: string, fileName: string): { data: ParsedFile | null, warnings: string[], errors: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];

  try {
    const raw: PackingFileJSON = JSON.parse(jsonStr);
    
    if (raw.version !== "1.1") {
      errors.push(`Unsupported version ${raw.version}. Expected 1.1.`);
      return { data: null, warnings, errors };
    }
    
    const is1Based = raw.indexing === "1-based";
    const parsedClasses: ParsedContactClass[] = [];

    raw.graphs.forEach((graph, graphIndex) => {
      const classId = graph.nombre || `Class ${graphIndex + 1}`;
      
      if (graph.discos !== graph.centros.length) {
        errors.push(`${classId}: 'discos' (${graph.discos}) does not match 'centros' length (${graph.centros.length}).`);
        return;
      }

      const scope: Record<string, any> = {};
      if (graph.auxiliary_constants) {
        for (const [key, expr] of Object.entries(graph.auxiliary_constants)) {
          try {
            const sanitizedExpr = typeof expr === 'string' ? expr.replace(/\*\*/g, '^') : expr;
            const val = math.evaluate(sanitizedExpr as string, scope);
            scope[key] = val;
          } catch (e: any) {
            errors.push(`${classId}: Error evaluating auxiliary constant '${key}': ${e.message}`);
            return;
          }
        }
      }

      const parsedCenters: [ParsedCoordinate, ParsedCoordinate][] = [];
      for (let i = 0; i < graph.centros.length; i++) {
        const c = graph.centros[i];
        if (!Array.isArray(c) || c.length < 2) {
          errors.push(`${classId}: Invalid center format at index ${i}`);
          return;
        }
        
        try {
          const x = parseCoordinate(c[0], scope);
          const y = parseCoordinate(c[1], scope);
          if (isNaN(x.floatValue) || isNaN(y.floatValue)) throw new Error("NaN result");
          parsedCenters.push([x, y]);
        } catch (e: any) {
          errors.push(`${classId}: Expression evaluation error for center ${i}: ${e.message}`);
          return;
        }
      }

      const parsedContacts: [number, number][] = [];
      const adjacency = new Set<string>();

      for (let c of graph.contactos) {
        if (!Array.isArray(c) || c.length < 2) {
          errors.push(`${classId}: Invalid contact format.`);
          return;
        }
        
        const u = is1Based ? c[0] - 1 : c[0];
        const v = is1Based ? c[1] - 1 : c[1];

        if (u < 0 || u >= graph.discos || v < 0 || v >= graph.discos) {
          errors.push(`${classId}: Contact index out of bounds [${c[0]}, ${c[1]}].`);
          return;
        }

        if (u === v) {
          errors.push(`${classId}: Self-loop detected at disk ${u}.`);
          return;
        }
        
        const edgeKey = u < v ? `${u}-${v}` : `${v}-${u}`;
        if (!adjacency.has(edgeKey)) {
          adjacency.add(edgeKey);
          parsedContacts.push([u, v]);
        }
      }

      const BIG_TOLERANCE = math.bignumber(1e-12);
      const BIG_CONTACT_DIST = math.bignumber(2.0);

      parsedContacts.forEach(([u, v]) => {
        const dExact = distanceBigNumber(parsedCenters[u], parsedCenters[v]);
        const diff = math.abs(math.subtract(dExact, BIG_CONTACT_DIST));
        if (math.larger(diff, BIG_TOLERANCE)) {
          const dFloat = typeof dExact === 'object' && dExact && 'toNumber' in dExact ? dExact.toNumber() : Number(dExact);
          warnings.push(`${classId}: Contact distance mismatch for [${u}, ${v}]. d = ${dFloat.toFixed(15)}`);
        }
      });

      for (let i = 0; i < graph.discos; i++) {
        for (let j = i + 1; j < graph.discos; j++) {
          const edgeKey = `${i}-${j}`;
          if (!adjacency.has(edgeKey)) {
            const dExact = distanceBigNumber(parsedCenters[i], parsedCenters[j]);
            const limit = math.subtract(BIG_CONTACT_DIST, BIG_TOLERANCE);
            if (math.smaller(dExact, limit)) {
              const dFloat = typeof dExact === 'object' && dExact && 'toNumber' in dExact ? dExact.toNumber() : Number(dExact);
              warnings.push(`${classId}: Non-overlap violation for [${i}, ${j}]. d = ${dFloat.toFixed(15)}`);
            }
          }
        }
      }

      const m = parsedContacts.length;
      const n = graph.discos;
      const dof = 2 * n - m - 3;

      parsedClasses.push({
        id: classId,
        disksCount: n,
        centers: parsedCenters,
        contacts: parsedContacts,
        dof,
        fileName
      });
    });

    if (parsedClasses.length === 0) {
      errors.push("No valid contact classes found in file.");
      return { data: null, warnings, errors };
    }

    return {
      data: {
        fileName,
        version: raw.version,
        contactClasses: parsedClasses
      },
      warnings,
      errors
    };

  } catch (err: any) {
    errors.push(`Parse error: ${err.message}`);
    return { data: null, warnings, errors };
  }
}
