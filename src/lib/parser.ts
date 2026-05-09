import { PackingFileJSON, ParsedFile, ParsedContactClass } from './types';

export const TOLERANCE = 1e-6;
export const CONTACT_DISTANCE = 2.0;

export function evaluateMath(expression: string): number {
  if (!expression || expression.trim() === '') return NaN;
  
  let expr = expression.replace(/\bpi\b/gi, Math.PI.toString());
  
  const tokens: string[] = [];
  const regex = /\s*([A-Za-z_][A-Za-z0-9_]*|[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?|\S)\s*/g;
  let match;
  while ((match = regex.exec(expr)) !== null) {
    if (match[1]) tokens.push(match[1]);
  }
  
  let pos = 0;
  
  function parseExpression(): number {
    let value = parseTerm();
    while (pos < tokens.length && (tokens[pos] === '+' || tokens[pos] === '-')) {
      const op = tokens[pos++];
      const nextTerm = parseTerm();
      if (op === '+') value += nextTerm;
      else value -= nextTerm;
    }
    return value;
  }
  
  function parseTerm(): number {
    let value = parseFactor();
    while (pos < tokens.length && (tokens[pos] === '*' || tokens[pos] === '/')) {
      const op = tokens[pos++];
      const nextFactor = parseFactor();
      if (op === '*') value *= nextFactor;
      else value /= nextFactor;
    }
    return value;
  }
  
  function parseFactor(): number {
    if (pos >= tokens.length) throw new Error("Unexpected end of expression");
    
    let token = tokens[pos++];
    
    if (token === '+') return parseFactor();
    if (token === '-') return -parseFactor();
    
    if (token === '(') {
      const value = parseExpression();
      if (pos >= tokens.length || tokens[pos++] !== ')') {
        throw new Error("Missing closing parenthesis");
      }
      return value;
    }
    
    const functions: Record<string, (n: number) => number> = {
      sqrt: Math.sqrt,
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      sind: (n) => Math.sin(n * Math.PI / 180),
      cosd: (n) => Math.cos(n * Math.PI / 180),
      tand: (n) => Math.tan(n * Math.PI / 180),
      abs: Math.abs,
      floor: Math.floor,
      ceil: Math.ceil
    };
    
    if (functions[token.toLowerCase()]) {
      if (pos >= tokens.length || tokens[pos] !== '(') {
        throw new Error(`Expected '(' after function ${token}`);
      }
      pos++;
      const value = parseExpression();
      if (pos >= tokens.length || tokens[pos++] !== ')') {
        throw new Error("Missing closing parenthesis");
      }
      return functions[token.toLowerCase()](value);
    }
    
    const num = parseFloat(token);
    if (isNaN(num)) {
      throw new Error(`Invalid token: ${token}`);
    }
    return num;
  }
  
  const result = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Unexpected token at end: ${tokens[pos]}`);
  }
  
  return result;
}

function distance(p1: [number, number], p2: [number, number]): number {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  return Math.sqrt(dx * dx + dy * dy);
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

      const parsedCenters: [number, number][] = [];
      for (let i = 0; i < graph.centros.length; i++) {
        const c = graph.centros[i];
        if (!Array.isArray(c) || c.length < 2) {
          errors.push(`${classId}: Invalid center format at index ${i}`);
          return;
        }
        
        try {
          const x = typeof c[0] === 'string' ? evaluateMath(c[0]) : c[0];
          const y = typeof c[1] === 'string' ? evaluateMath(c[1]) : c[1];
          if (isNaN(x) || isNaN(y)) throw new Error("NaN result");
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

      parsedContacts.forEach(([u, v]) => {
        const d = distance(parsedCenters[u], parsedCenters[v]);
        if (Math.abs(d - CONTACT_DISTANCE) > TOLERANCE) {
          warnings.push(`${classId}: Contact distance mismatch for [${u}, ${v}]. d = ${d.toFixed(6)}`);
        }
      });

      for (let i = 0; i < graph.discos; i++) {
        for (let j = i + 1; j < graph.discos; j++) {
          const edgeKey = `${i}-${j}`;
          if (!adjacency.has(edgeKey)) {
            const d = distance(parsedCenters[i], parsedCenters[j]);
            if (d < CONTACT_DISTANCE - TOLERANCE) {
              warnings.push(`${classId}: Non-overlap violation for [${i}, ${j}]. d = ${d.toFixed(6)}`);
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
