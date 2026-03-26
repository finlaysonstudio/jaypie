import type { StorableEntity } from "@jaypie/dynamodb";

interface HistoryEvent {
  email?: string;
  event: string;
  identity?: string;
  time: string;
}

type SessionEntity = StorableEntity & {
  events: HistoryEvent[];
};

export type { HistoryEvent, SessionEntity };
