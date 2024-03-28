import { JAYPIE } from "@jaypie/core";
import dynamicExport from "./dynamicExport.function.js";

//
//
// Export
//

export const { getMessages, getSecret, sendBatchMessages, sendMessage } =
  await dynamicExport({
    functions: ["getMessages", "getSecret", "sendBatchMessages", "sendMessage"],
    moduleImport: JAYPIE.LIB.AWS,
  });
