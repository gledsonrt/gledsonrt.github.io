// src/types/fmin.d.ts
declare module "fmin" {
  export interface NelderMeadResult {
    x: number[];
    fx: number;
    iterations: number;
    message?: string;
  }

  export function nelderMead(
    f: (x: number[]) => number,
    x0: number[],
    options?: { maxIterations?: number; minErrorDelta?: number }
  ): NelderMeadResult;
}