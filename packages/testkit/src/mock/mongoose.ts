import { createMockFunction } from "./utils";

// Constants for mock values
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TAG = "MONGOOSE";

// Mongoose mock functions
export const connect = createMockFunction<() => boolean>(() => {
  // Using TAG: MONGOOSE for connection mock
  return true;
});

export const connectFromSecretEnv = createMockFunction<() => boolean>(() => {
  // Using TAG: MONGOOSE for connectFromSecretEnv mock
  return true;
});

export const disconnect = createMockFunction<() => boolean>(() => {
  // Using TAG: MONGOOSE for disconnect mock
  return true;
});

export { mongoose } from "@jaypie/mongoose";
