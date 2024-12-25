// Framework-agnostic frontend utilities

import { v4 } from "uuid";

export const uuid = (): string => v4();

export * from "@jaypie/errors";
