import {
  fabricIndex,
  type IndexDefinition,
  registerModel,
} from "@jaypie/fabric";

const NOTE_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
  fabricIndex("xid"),
];

const NOTE_MODEL = "note";

registerModel({ model: NOTE_MODEL, indexes: NOTE_INDEXES });

export { NOTE_INDEXES, NOTE_MODEL };
