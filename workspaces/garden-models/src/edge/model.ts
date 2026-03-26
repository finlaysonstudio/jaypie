import { type IndexDefinition, registerModel } from "@jaypie/fabric";

//
//
// Constants
//

const EDGE_INDEXES: IndexDefinition[] = [
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

const EDGE_MODEL = "edge";

//
//
// Registration
//

registerModel({ model: EDGE_MODEL, indexes: EDGE_INDEXES });

//
//
// Export
//

export { EDGE_INDEXES, EDGE_MODEL };
