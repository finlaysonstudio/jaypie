import { JAYPIE } from "@jaypie/core";
import dynamicExport from "./dynamicExport.function.js";

//
//
// Export
//

export const { getSecret } = await dynamicExport({
  functions: ["getSecret"],
  moduleImport: JAYPIE.LIB.AWS,
});
