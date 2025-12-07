import { loadPackage } from "./loadPackage.js";
import type * as MongooseTypes from "@jaypie/mongoose";

type MongooseModule = typeof MongooseTypes;

export function connect(
  ...args: Parameters<MongooseModule["connect"]>
): ReturnType<MongooseModule["connect"]> {
  return loadPackage<MongooseModule>("@jaypie/mongoose").connect(...args);
}

export function connectFromSecretEnv(
  ...args: Parameters<MongooseModule["connectFromSecretEnv"]>
): ReturnType<MongooseModule["connectFromSecretEnv"]> {
  return loadPackage<MongooseModule>("@jaypie/mongoose").connectFromSecretEnv(
    ...args,
  );
}

export function disconnect(): ReturnType<MongooseModule["disconnect"]> {
  return loadPackage<MongooseModule>("@jaypie/mongoose").disconnect();
}

// Re-export mongoose via getter to lazy load
export const mongoose: MongooseModule["mongoose"] = new Proxy(
  {} as MongooseModule["mongoose"],
  {
    get(_, prop) {
      const mongoosePkg = loadPackage<MongooseModule>("@jaypie/mongoose")
        .mongoose as unknown as Record<string, unknown>;
      return mongoosePkg[prop as string];
    },
    apply(_, thisArg, args) {
      const mongoosePkg = loadPackage<MongooseModule>("@jaypie/mongoose")
        .mongoose as unknown as (...args: unknown[]) => unknown;
      return Reflect.apply(mongoosePkg, thisArg, args);
    },
  },
);
