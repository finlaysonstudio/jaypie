import {
  fabricIndex,
  type IndexDefinition,
  registerModel,
} from "@jaypie/fabric";

const ENTITY_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
  fabricIndex("category"),
  fabricIndex("xid"),
];

const ENTITY_MODEL = "entity";

registerModel({ model: ENTITY_MODEL, indexes: ENTITY_INDEXES });

export { ENTITY_INDEXES, ENTITY_MODEL };
