import { BlockType, TextType } from "@aws-sdk/client-textract";

export const TYPE = {
  ...BlockType,
  EMBEDDING_BOX: "CUSTOM_EMBEDDING_BOX" as const,
  LAYOUT_BOX: "CUSTOM_LAYOUT_BOX" as const,
  TOKEN_BOX: "CUSTOM_TOKEN_BOX" as const,
};

export const WORD = {
  ...TextType,
};

export type BlockTypeValues = (typeof TYPE)[keyof typeof TYPE];
export type TextTypeValues = (typeof WORD)[keyof typeof WORD];
