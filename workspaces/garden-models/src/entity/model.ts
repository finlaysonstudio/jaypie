import { type IndexDefinition, registerModel } from "@jaypie/fabric";

//
//
// Constants
//

const ENTITY_INDEXES: IndexDefinition[] = [
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

const ENTITY_MODEL = "entity";

//
//
// Registration
//

registerModel({ model: ENTITY_MODEL, indexes: ENTITY_INDEXES });

//
//
// Export
//

export { ENTITY_INDEXES, ENTITY_MODEL };
