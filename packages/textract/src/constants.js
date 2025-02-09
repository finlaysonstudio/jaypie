import { BlockType, TextType } from "@aws-sdk/client-textract";

//
//
// Constants
//

export const TYPE = {
  ...BlockType,
  EMBEDDING_BOX: "CUSTOM_EMBEDDING_BOX",
  LAYOUT_BOX: "CUSTOM_LAYOUT_BOX",
  TOKEN_BOX: "CUSTOM_TOKEN_BOX",
};

export const WORD = {
  ...TextType, // HANDWRITING or PRINTED
};
