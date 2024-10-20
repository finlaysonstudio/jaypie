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
};

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
};
