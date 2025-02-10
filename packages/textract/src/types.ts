import { BlockTypeValues } from "./constants.js";

export interface Block {
  Id: string;
  BlockType: BlockTypeValues;
  Relationships?: Array<{
    Type: string;
    Ids: string[];
  }>;
}

export interface TextractItem {
  id: string;
  blockType?: BlockTypeValues;
  text?: string;
  textType?: string;
  str?: () => string;
  toString?: () => string;
  listItems?: () => TextractItem[];
  listWords?: () => TextractItem[];
  listContent?: () => TextractItem[];
  listLayoutChildren?: () => TextractItem[];
  listTables?: () => TextractItem[];
  listLines?: () => TextractItem[];
  listRows?: () => TextractItem[];
  listCells?: () => TextractItem[];
  listSubCells?: () => TextractItem[];
  listFields?: () => TextractItem[];
  listTitles?: () => TextractItem[];
  listFooters?: () => TextractItem[];
  listTextLines?: () => TextractItem[];
  listResultsByConfidence?: () => TextractItem[];
  firstTitle?: TextractItem;
  firstFooter?: TextractItem;
  parentPage?: TextractPage;
  nSubCells?: number;
  key?: TextractItem;
}

export interface TextractPage {
  id: string;
  text: string;
  layout: TextractLayout;
  listBlocks: () => Block[];
  listLines: () => TextractItem[];
  listTables: () => TextractItem[];
  listSignatures: () => TextractItem[];
  getItemByBlockId: (id: string) => TextractItem;
}

export interface TextractLayout {
  listItems: () => TextractItem[];
  str: () => string;
}

export interface GetItemContentOptions {
  ignoreWords?: boolean;
  returnedIds?: string[];
}

export interface IndexObject {
  element: {
    [blockType: string]: {
      [id: string]: {
        id: string;
        type: string;
        children?: string[];
      };
    };
  };
  id: { [id: string]: string };
  tableFirstWord: { [id: string]: TextractItem };
}
