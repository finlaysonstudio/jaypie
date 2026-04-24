import {
  fabricIndex,
  type IndexDefinition,
  registerModel,
} from "@jaypie/fabric";

const JOURNAL_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
  fabricIndex("category"),
];

const JOURNAL_MODEL = "journal";

registerModel({ model: JOURNAL_MODEL, indexes: JOURNAL_INDEXES });

export { JOURNAL_INDEXES, JOURNAL_MODEL };
