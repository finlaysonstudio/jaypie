export const TYPE = {
  ANY: "*",
  ARRAY: Array,
  BOOLEAN: Boolean,
  CLASS: "_CLASS",
  FUNCTION: Function,
  NUMBER: Number,
  NULL: null,
  OBJECT: Object,
  STRING: String,
  UNDEFINED: "_UNDEFINED",
} as const;

export type ValidationType =
  | typeof TYPE.ANY
  | typeof TYPE.ARRAY
  | typeof TYPE.BOOLEAN
  | typeof TYPE.CLASS
  | typeof TYPE.FUNCTION
  | typeof TYPE.NUMBER
  | typeof TYPE.NULL
  | typeof TYPE.OBJECT
  | typeof TYPE.STRING
  | typeof TYPE.UNDEFINED;
