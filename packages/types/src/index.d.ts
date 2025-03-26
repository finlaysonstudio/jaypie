// JSON Types - Building blocks for JSON:API

export type JsonValue =
  | { [key: string]: JsonValue }
  | boolean
  | JsonValue[]
  | null
  | number
  | string;

export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = Array<JsonArray | JsonValue | JsonObject>;
export type JsonReturn = JsonArray | JsonObject;

export interface WithJsonFunction {
  json: () => JsonReturn;
}

// JSON:API Types

export type JsonApiId = string;

export type JsonApiType = string;

export type JsonApiAttributes = JsonObject;

export type JsonApiRelationships = {
  [key: string]: {
    data:
      | { id: JsonApiId; type: JsonApiType }
      | null
      | { id: JsonApiId; type: JsonApiType }[];
  };
};

export type JsonApiResource = {
  id: JsonApiId;
  type: JsonApiType;
  attributes?: JsonApiAttributes;
  relationships?: JsonApiRelationships;
};

// API Types - Types for API requests and responses
export type JsonApiResponse = {
  data: JsonApiResource | JsonApiResource[] | null;
  errors?: JsonApiError[];
  included?: JsonApiResource[];
  jsonapi?: JsonObject;
  links?: JsonObject;
  meta?: JsonObject;
};

export type JsonApiSingleResourceResponse = {
  data: JsonApiResource;
  included?: JsonApiResource[];
  jsonapi?: JsonObject;
  links?: JsonObject;
  meta?: JsonObject;
};

export type JsonApiCollectionResourceResponse = {
  data: JsonApiResource[];
  included?: JsonApiResource[];
  jsonapi?: JsonObject;
  links?: JsonObject;
  meta?: JsonObject;
};

export type JsonApiErrorResponse = {
  errors: JsonApiError[];
  jsonapi?: JsonObject;
  links?: JsonObject;
  meta?: JsonObject;
};

export type JsonApiError = {
  code?: string;
  detail?: string;
  id?: string;
  links?: JsonObject;
  meta?: JsonObject;
  source?: {
    header?: string;
    parameter?: string;
    pointer?: string;
  };
  status: number | string;
  title: string;
};

// Natural Schema - A schema syntax that is self-describing

type EmptyArray = never[];
type EmptyObject = Record<string, never>;

export type NaturalSchema =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ObjectConstructor
  | ArrayConstructor
  | string[]
  | EmptyArray
  | EmptyObject
  | NaturalSchemaObject
  | NaturalSchema[];

export type NaturalSchemaObject = {
  [key: string]: NaturalSchema;
};

export {};
