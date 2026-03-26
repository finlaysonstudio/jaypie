import { type IndexDefinition, registerModel } from "@jaypie/fabric";

//
//
// Constants
//

const APIKEY_INDEXES: IndexDefinition[] = [
  {
    name: "indexAlias",
    pk: ["scope", "model", "alias"],
    sk: ["sequence"],
    sparse: true,
  },
  { name: "indexScope", pk: ["scope", "model"], sk: ["sequence"] },
];

const APIKEY_MODEL = "apikey";

//
//
// Registration
//

registerModel({ model: APIKEY_MODEL, indexes: APIKEY_INDEXES });

//
//
// Export
//

export { APIKEY_INDEXES, APIKEY_MODEL };
