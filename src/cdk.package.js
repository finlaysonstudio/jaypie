import { JAYPIE } from "@jaypie/core";
import dynamicExport from "./dynamicExport.function.js";

//
//
// Export
//

export const {
  cfnOutput,
  isValidHostname,
  isValidSubdomain,
  mergeDomain,
  projectTagger,
} = await dynamicExport({
  functions: [
    "cfnOutput",
    "isValidHostname",
    "isValidSubdomain",
    "mergeDomain",
    "projectTagger",
  ],
  moduleImport: JAYPIE.LIB.CDK,
});
