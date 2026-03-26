import type { StorableEntity } from "@jaypie/dynamodb";

//
//
// Constants
//

const EDGE_CATEGORIES = [
  "blocks",
  "parent",
  "references",
  "related",
] as const;

type EdgeCategory = (typeof EDGE_CATEGORIES)[number];

//
//
// Types
//

type EdgeEntity = StorableEntity & {
  category: EdgeCategory;
  source: string;
  target: string;
};

//
//
// Export
//

export { EDGE_CATEGORIES };
export type { EdgeCategory, EdgeEntity };
