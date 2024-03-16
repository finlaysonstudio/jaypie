import { JAYPIE } from "@jaypie/core";
import dynamicExport from "./dynamicExport.function.js";

//
//
// Export
//

export const { connectFromSecretEnv, disconnect } = dynamicExport({
  exports: ["connectFromSecretEnv", "disconnect"],
  moduleImport: JAYPIE.LIB.MONGOOSE,
});
