import { JAYPIE } from "@jaypie/core";
import dynamicExport from "./dynamicExport.function.js";

//
//
// Export
//

export const { getSecret } = await dynamicExport({
  functions: ["getMessages", "getSecret", "sendBatchMessages", "sendMessage"],
  moduleImport: JAYPIE.LIB.AWS,
});
