import { loadPackage } from "./loadPackage.js";
import type * as LambdaTypes from "@jaypie/lambda";

type LambdaModule = typeof LambdaTypes;

export function lambdaHandler(
  ...args: Parameters<LambdaModule["lambdaHandler"]>
): ReturnType<LambdaModule["lambdaHandler"]> {
  return loadPackage<LambdaModule>("@jaypie/lambda").lambdaHandler(...args);
}
