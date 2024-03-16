import { JAYPIE } from "@jaypie/core";
import dynamicExport from "./dynamicExport.function.js";

//
//
// Export
//

export const { getSecret } = dynamicExport({
  exports: ["getSecret"],
  moduleImport: JAYPIE.LIB.AWS,
});
