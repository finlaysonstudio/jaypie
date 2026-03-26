import { type IndexDefinition, registerModel } from "@jaypie/fabric";

//
//
// Constants
//

const JOURNAL_INDEXES: IndexDefinition[] = [
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
];

const JOURNAL_MODEL = "journal";

//
//
// Registration
//

registerModel({ model: JOURNAL_MODEL, indexes: JOURNAL_INDEXES });

//
//
// Export
//

export { JOURNAL_INDEXES, JOURNAL_MODEL };
