import { type IndexDefinition, registerModel } from "@jaypie/fabric";

//
//
// Constants
//

const NOTE_INDEXES: IndexDefinition[] = [
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

const NOTE_MODEL = "note";

//
//
// Registration
//

registerModel({ model: NOTE_MODEL, indexes: NOTE_INDEXES });

//
//
// Export
//

export { NOTE_INDEXES, NOTE_MODEL };
