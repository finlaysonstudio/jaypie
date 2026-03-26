import type { StorableEntity } from "@jaypie/dynamodb";

type GardenEntity = StorableEntity & {
  name: string;
};

export type { GardenEntity };
