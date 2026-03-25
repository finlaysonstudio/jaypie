import { type IndexDefinition, registerModel } from "@jaypie/fabric";

//
//
// Constants
//

const GARDEN_INDEXES: IndexDefinition[] = [
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
  {
    name: "indexXid",
    pk: ["scope", "model", "xid"],
    sk: ["sequence"],
    sparse: true,
  },
];

const GARDEN_MODEL = "garden";

//
//
// Registration
//

registerModel({ model: GARDEN_MODEL, indexes: GARDEN_INDEXES });

//
//
// Export
//

export { GARDEN_INDEXES, GARDEN_MODEL };
