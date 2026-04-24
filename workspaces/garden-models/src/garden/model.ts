import {
  fabricIndex,
  type IndexDefinition,
  registerModel,
} from "@jaypie/fabric";

const GARDEN_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
  fabricIndex("xid"),
];

const GARDEN_MODEL = "garden";

registerModel({ model: GARDEN_MODEL, indexes: GARDEN_INDEXES });

export { GARDEN_INDEXES, GARDEN_MODEL };
