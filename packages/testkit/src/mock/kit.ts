import {
  parseFrontmatter as kitParseFrontmatter,
  stringifyFrontmatter as kitStringifyFrontmatter,
} from "@jaypie/kit";

import { createMockReturnedFunction, createMockWrappedFunction } from "./utils";

export const isLocalEnv = createMockReturnedFunction(false);

export const isNodeTestEnv = createMockReturnedFunction(true);

export const isProductionEnv = createMockReturnedFunction(false);

export const parseFrontmatter = createMockWrappedFunction(
  kitParseFrontmatter as (...args: unknown[]) => unknown,
  { throws: true },
);

export const stringifyFrontmatter = createMockWrappedFunction(
  kitStringifyFrontmatter as (...args: unknown[]) => unknown,
  { throws: true },
);
