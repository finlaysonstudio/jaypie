import { JAYPIE } from "@jaypie/core";
import dynamicExport from "./dynamicExport.function.js";

//
//
// Export
//

// Required dependencies
export * from "@jaypie/core";

// Optional dependencies are wrapped in a dynamic import
export const { getMessages, getSecret, sendBatchMessages, sendMessage } =
  await dynamicExport({
    functions: ["getMessages", "getSecret", "sendBatchMessages", "sendMessage"],
    moduleImport: JAYPIE.LIB.AWS,
  });

export const { lambdaHandler } = await dynamicExport({
  functions: ["lambdaHandler"],
  moduleImport: JAYPIE.LIB.LAMBDA,
});

export const { connectFromSecretEnv, disconnect } = await dynamicExport({
  functions: ["connectFromSecretEnv", "disconnect"],
  moduleImport: JAYPIE.LIB.MONGOOSE,
});
