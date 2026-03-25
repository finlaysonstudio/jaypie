import type { StorableEntity } from "@jaypie/dynamodb";

interface UpsertUserInput {
  email: string;
  name: string;
  sub: string;
}

type UserEntity = StorableEntity & {
  auth0Sub: string;
  permissions: string[];
};

export type { UpsertUserInput, UserEntity };
