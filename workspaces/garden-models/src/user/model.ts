import { fabricIndex, type IndexDefinition, registerModel } from "@jaypie/fabric";

const DEFAULT_PERMISSIONS = ["registered:*"];

const USER_INDEXES: IndexDefinition[] = [
  fabricIndex(),
  fabricIndex("alias"),
  fabricIndex("xid"),
];

const USER_MODEL = "user";

registerModel({ model: USER_MODEL, indexes: USER_INDEXES });

export { DEFAULT_PERMISSIONS, USER_INDEXES, USER_MODEL };
