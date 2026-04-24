import {
  fabricIndex,
  type IndexDefinition,
  registerModel,
} from "@jaypie/fabric";

const TASK_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
  fabricIndex("category"),
  fabricIndex("xid"),
];

const TASK_MODEL = "task";

registerModel({ model: TASK_MODEL, indexes: TASK_INDEXES });

export { TASK_INDEXES, TASK_MODEL };
