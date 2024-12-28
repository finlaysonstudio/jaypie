import { JsonApiData, JsonApiError } from "./types/jaypie-testkit";

export const jsonApiErrorSchema = {
  type: "object",
  properties: {
    errors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          status: { type: "number" },
          title: { type: "string" },
          detail: { type: "string" },
        },
        required: ["status", "title"],
      },
      minItems: 1,
    },
  },
  required: ["errors"],
} as const;

export const jsonApiSchema = {
  type: "object",
  properties: {
    data: {
      type: "object",
      properties: {
        id: { type: "string" },
        type: { type: "string" },
        attributes: { type: "object" },
        links: { type: "object" },
        meta: { type: "object" },
        relationships: { type: "object" },
      },
      required: ["id", "type"],
    },
    meta: { type: "object" },
  },
  required: ["data"],
} as const;

// Type guards
export const isJsonApiError = (obj: unknown): obj is JsonApiError => {
  if (!obj || typeof obj !== "object") return false;
  return "errors" in obj && Array.isArray((obj as JsonApiError).errors);
};

export const isJsonApiData = (obj: unknown): obj is JsonApiData => {
  if (!obj || typeof obj !== "object") return false;
  return "data" in obj && typeof (obj as JsonApiData).data === "object";
};
