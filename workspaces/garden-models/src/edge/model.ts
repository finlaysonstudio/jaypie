import { fabricIndex, type IndexDefinition, registerModel } from "@jaypie/fabric";

const EDGE_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
  fabricIndex("category"),
  fabricIndex("xid"),
];

const EDGE_MODEL = "edge";

registerModel({ model: EDGE_MODEL, indexes: EDGE_INDEXES });

export { EDGE_INDEXES, EDGE_MODEL };
