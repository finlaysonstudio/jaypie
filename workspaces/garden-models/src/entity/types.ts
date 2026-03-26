import type { StorableEntity } from "@jaypie/dynamodb";

//
//
// Types
//

type EntityEntity = StorableEntity & {
  content?: string;
};

//
//
// Export
//

export type { EntityEntity };
