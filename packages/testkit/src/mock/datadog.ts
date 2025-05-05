import { createMockFunction } from "./utils";

export const recordMetric =
  createMockFunction<(name: string, value: number, tags?: string[]) => void>();

export const startSpan = createMockFunction<
  (name: string, options?: any) => { finish: () => void }
>(() => ({ finish: createMockFunction() }));
