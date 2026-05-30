import { create, all } from 'mathjs';

export const math = create(all, {
  number: 'BigNumber',
  precision: 64
});

// Register degree-based trigonometric functions in mathjs
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
  }
}, { override: true });
