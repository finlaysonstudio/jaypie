import type { StorableEntity } from "@jaypie/dynamodb";

//
//
// Constants
//

const TASK_CATEGORIES = ["active", "backlog", "blocked", "done"] as const;

type TaskCategory = (typeof TASK_CATEGORIES)[number];

//
//
// Types
//

type TaskEntity = StorableEntity & {
  category: TaskCategory;
  content?: string;
};

//
//
// Export
//

export { TASK_CATEGORIES };
export type { TaskCategory, TaskEntity };
