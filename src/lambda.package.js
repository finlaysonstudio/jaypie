import { JAYPIE } from "@jaypie/core";
import dynamicExport from "./dynamicExport.function.js";

//
//
// Export
//

export const { lambdaHandler } = await dynamicExport({
  functions: ["lambdaHandler"],
  moduleImport: JAYPIE.LIB.LAMBDA,
});
