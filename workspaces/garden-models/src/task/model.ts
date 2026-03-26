import { type IndexDefinition, registerModel } from "@jaypie/fabric";

//
//
// Constants
//

const TASK_INDEXES: IndexDefinition[] = [
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
  {
    name: "indexCategory",
    pk: ["scope", "model", "category"],
    sk: ["sequence"],
  },
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
  {
    name: "indexXid",
    pk: ["scope", "model", "xid"],
    sk: ["sequence"],
    sparse: true,
  },
];

const TASK_MODEL = "task";

//
//
// Registration
//

registerModel({ model: TASK_MODEL, indexes: TASK_INDEXES });

//
//
// Export
//

export { TASK_INDEXES, TASK_MODEL };
