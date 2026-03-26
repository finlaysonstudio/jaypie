import type { StorableEntity } from "@jaypie/dynamodb";

//
//
// Constants
//

const JOURNAL_CATEGORIES = ["note", "record", "review", "session"] as const;

type JournalCategory = (typeof JOURNAL_CATEGORIES)[number];

//
//
// Types
//

type JournalEntity = StorableEntity & {
  category: JournalCategory;
  content: string;
};

//
//
// Export
//

export { JOURNAL_CATEGORIES };
export type { JournalCategory, JournalEntity };
