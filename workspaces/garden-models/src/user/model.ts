import { type IndexDefinition, registerModel } from "@jaypie/fabric";

//
//
// Constants
//

const DEFAULT_PERMISSIONS = ["registered:*"];

const USER_INDEXES: IndexDefinition[] = [
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

const USER_MODEL = "user";

//
//
// Registration
//

registerModel({ model: USER_MODEL, indexes: USER_INDEXES });

//
//
// Export
//

export { DEFAULT_PERMISSIONS, USER_INDEXES, USER_MODEL };
