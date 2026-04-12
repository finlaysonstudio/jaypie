import { fabricIndex, type IndexDefinition, registerModel } from "@jaypie/fabric";

const APIKEY_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
];

const APIKEY_MODEL = "apikey";

registerModel({ model: APIKEY_MODEL, indexes: APIKEY_INDEXES });

export { APIKEY_INDEXES, APIKEY_MODEL };
