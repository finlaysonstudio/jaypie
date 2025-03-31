import { JAYPIE, log } from "@jaypie/core";

export const getLogger = () => log.lib({ lib: JAYPIE.LIB.LLM });

export default getLogger();
