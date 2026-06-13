import { create, all } from 'mathjs';
import { Matrix, EigenvalueDecomposition, solve } from 'ml-matrix';

export const math = create(all, {
  number: 'BigNumber',
  precision: 64
});

function findRoots(expression: string, varName: string = 'z', parentScope: any = {}): { real: number; imag: number }[] {
  const sanitized = expression.replace(/\*\*/g, '^');
  const node = math.rationalize(sanitized);
  
  let degree = 0;
  node.traverse((n: any) => {
    if (n.isSymbolNode && n.name === varName) {
      degree = Math.max(degree, 1);
    } else if (n.isOperatorNode && (n.op === '^' || n.name === 'pow')) {
      const left = n.args[0];
      const right = n.args[1];
      if (left.isSymbolNode && left.name === varName && right.isConstantNode) {
        degree = Math.max(degree, Number(right.value));
      }
    }
  });

  if (degree === 0) {
    throw new Error('Constant expression, cannot solve roots');
  }

  const xVals: number[] = [];
  const yVals: number[] = [];
  
  const symbolsUsed = new Set<string>();
  node.traverse((n: any) => {
    if (n.isSymbolNode) {
      symbolsUsed.add(n.name);
    }
  });

  const baseScope: Record<string, any> = {};
  symbolsUsed.forEach(sym => {
    if (sym !== varName && sym !== 'pi' && sym !== 'e' && sym !== 'i') {
      let val;
      if (parentScope && typeof parentScope.get === 'function') {
        val = parentScope.get(sym);
      } else if (parentScope) {
        val = (parentScope as any)[sym];
      }
      if (val !== undefined) {
        baseScope[sym] = val;
      }
    }
  });

  const compiled = node.compile();
  for (let i = 0; i <= degree; i++) {
    xVals.push(i);
    const scope = { ...baseScope, [varName]: i };
    const y = compiled.evaluate(scope);
    yVals.push(Number(y));
  }

  const V_data: number[][] = [];
  for (let i = 0; i <= degree; i++) {
    const row: number[] = [];
    const x = xVals[i];
    for (let j = 0; j <= degree; j++) {
      row.push(Math.pow(x, degree - j));
    }
    V_data.push(row);
  }

  const V = new Matrix(V_data);
  const Y = Matrix.columnVector(yVals);
  const C_coeff = solve(V, Y);
  
  const coeffs = C_coeff.to1DArray();

  const a_n = coeffs[0];
  if (Math.abs(a_n) < 1e-12) {
    throw new Error('Leading coefficient is too close to zero');
  }
  
  const monicCoeffs = coeffs.map(c => c / a_n);

  const n = degree;
  const companionData: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      if (j === n - 1) {
        row.push(-monicCoeffs[n - i]);
      } else if (i === j + 1) {
        row.push(1);
      } else {
        row.push(0);
      }
    }
    companionData.push(row);
  }

  const companion = new Matrix(companionData);
  const evd = new EigenvalueDecomposition(companion) as any;
  
  const realParts = evd.d;
  const imagParts = evd.e;

  const roots: { real: number; imag: number }[] = [];
  for (let i = 0; i < realParts.length; i++) {
    roots.push({ real: realParts[i], imag: imagParts[i] });
  }

  const TOL = 1e-9;
  const realRoots = roots.filter(r => Math.abs(r.imag) < TOL).sort((a, b) => a.real - b.real);
  const complexRoots = roots.filter(r => Math.abs(r.imag) >= TOL).sort((a, b) => {
    if (Math.abs(a.real - b.real) < TOL) {
      return a.imag - b.imag;
    }
    return a.real - b.real;
  });

  return [...realRoots, ...complexRoots];
}

const CRootOf = function (args: any[], mathInstance: any, scope: any) {
  if (args.length !== 2) {
    throw new Error('CRootOf expects 2 arguments: a polynomial expression and a root index.');
  }
  const polyNode = args[0];
  
  const indexSymbols = new Set<string>();
  args[1].traverse((n: any) => {
    if (n.isSymbolNode) indexSymbols.add(n.name);
  });
  
  const indexScope: Record<string, any> = {};
  indexSymbols.forEach(sym => {
    if (sym !== 'pi' && sym !== 'e' && sym !== 'i') {
      let val;
      if (scope && typeof scope.get === 'function') {
        val = scope.get(sym);
      } else if (scope) {
        val = (scope as any)[sym];
      }
      if (val !== undefined) {
        indexScope[sym] = val;
      }
    }
  });
  
  const indexVal = Number(args[1].compile().evaluate(indexScope));
  
  let varName = 'z';
  polyNode.traverse((n: any) => {
    if (n.isSymbolNode) {
      const name = n.name;
      const hasInScope = scope && typeof scope.has === 'function' ? scope.has(name) : (scope && name in scope);
      if (name !== 'pi' && name !== 'e' && name !== 'i' && !hasInScope) {
        varName = name;
      }
    }
  });

  const roots = findRoots(polyNode.toString(), varName, scope);
  if (indexVal < 0 || indexVal >= roots.length) {
    throw new Error(`CRootOf root index ${indexVal} out of bounds (found ${roots.length} roots)`);
  }
  
  return mathInstance.bignumber(roots[indexVal].real);
};
CRootOf.rawArgs = true;

// Register degree-based trigonometric functions and CRootOf in mathjs
math.import({
  sind: (x: any) => {
    const factor = math.divide(math.pi, 180);
    return math.sin(math.multiply(x, factor) as any);
  },
  cosd: (x: any) => {
    const factor = math.divide(math.pi, 180);
    return math.cos(math.multiply(x, factor) as any);
  },
  tand: (x: any) => {
    const factor = math.divide(math.pi, 180);
    return math.tan(math.multiply(x, factor) as any);
  },
  CRootOf: CRootOf
}, { override: true });

