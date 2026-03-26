import type { StorableEntity } from "@jaypie/dynamodb";

//
//
// Types
//

type NoteEntity = StorableEntity & {
  content: string;
  name: string;
};

//
//
// Export
//

export type { NoteEntity };
