import { loadPackage } from "./loadPackage.js";
import type * as KitTypes from "@jaypie/kit";

type KitModule = typeof KitTypes;

export function isNodeTestEnv(
  ...args: Parameters<KitModule["isNodeTestEnv"]>
): ReturnType<KitModule["isNodeTestEnv"]> {
  return loadPackage<KitModule>("@jaypie/kit").isNodeTestEnv(...args);
}

export function isProductionEnv(
  ...args: Parameters<KitModule["isProductionEnv"]>
): ReturnType<KitModule["isProductionEnv"]> {
  return loadPackage<KitModule>("@jaypie/kit").isProductionEnv(...args);
}
