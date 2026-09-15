// @jaypie/tildeskill/dynamodb
// Imports @jaypie/dynamodb (optional peer dependency). Markdown-only consumers
// import from "@jaypie/tildeskill" and never load it.

export type {
  DynamoDbStoreOptions,
  ListFilter,
  SkillRecord,
  SkillStore,
} from "../types";

export { createDynamoDbStore, SKILL_NAMESPACE } from "../stores/dynamodb";
