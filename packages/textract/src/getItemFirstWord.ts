import { TextractDocument } from "amazon-textract-response-parser";
import { log } from "@jaypie/core";
import { TYPE } from "./constants.js";
import { TextractItem } from "./types.js";

type TextractInput =
  | string
  | TextractItem
  | TextractDocument
  | TextractItem[]
  | null
  | undefined;

//
//
// Main
//

/**
 * Get the first word or similar "molecule sized" item (e.g., signature) from a Textract item.
 * @param item - The Textract item to get the first word from
 * @returns first word, query result, selection, or signature
 */
const getItemFirstWord = (
  item: TextractInput,
): TextractItem | string | null | undefined => {
  if (!item) return item;
  if (typeof item === "string") return item.split(" ")[0];
  // If item is an array, return the first item that has a first word
  if (Array.isArray(item)) {
    return item.reduce<TextractItem | string | null | undefined>(
      (acc, subject) => {
        if (acc) return acc;
        return getItemFirstWord(subject);
      },
      undefined,
    );
  }

  // Handle TextractDocument first
  if (item instanceof TextractDocument) {
    const pages = item.listPages();
    if (pages.length === 0) return undefined;
    const lines = pages[0].listLines();
    if (lines.length === 0) return undefined;
    return getItemFirstWord(lines[0] as unknown as TextractItem);
  }

  // Now item can only be TextractItem
  const textractItem = item as TextractItem;
  if (textractItem.blockType) {
    switch (textractItem.blockType) {
      case TYPE.CELL:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.KEY_VALUE_SET:
        if (typeof textractItem.listWords === "function") {
          return getItemFirstWord(textractItem.listWords());
        }
        return getItemFirstWord(textractItem.key);
      case TYPE.LAYOUT_FIGURE:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.LAYOUT_FOOTER:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.LAYOUT_HEADER:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.LAYOUT_KEY_VALUE:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.LAYOUT_LIST: {
        const children = textractItem.listLayoutChildren?.();
        if (children && children.length > 0) {
          return getItemFirstWord(children[0]);
        }
        return getItemFirstWord(textractItem.listContent?.());
      }
      case TYPE.LAYOUT_PAGE_NUMBER:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.LAYOUT_SECTION_HEADER:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.LAYOUT_TABLE:
        // LayoutTable supports listTables
        return getItemFirstWord(textractItem.listTables?.());
      case TYPE.LAYOUT_TEXT:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.LAYOUT_TITLE:
        return getItemFirstWord(textractItem.listContent?.());
      case TYPE.LINE:
        return getItemFirstWord(textractItem.listWords?.());
      case TYPE.MERGED_CELL:
        return getItemFirstWord(textractItem.listSubCells?.());
      case TYPE.PAGE:
        return getItemFirstWord(textractItem.listLines?.());
      case TYPE.SIGNATURE:
        return textractItem;
      case TYPE.TABLE:
        return textractItem.firstTitle
          ? getItemFirstWord(textractItem.firstTitle)
          : getItemFirstWord(textractItem.listRows?.());
      case TYPE.TABLE_FOOTER:
        return getItemFirstWord(textractItem.listWords?.());
      case TYPE.TABLE_TITLE:
        return getItemFirstWord(textractItem.listWords?.());
      case TYPE.TITLE:
        log.warn(`Known but undocumented blockType: ${textractItem.blockType}`);
        break;
      case TYPE.WORD:
        return textractItem;
      case TYPE.QUERY_RESULT:
        return textractItem;
      case TYPE.QUERY:
        return getItemFirstWord(textractItem.listResultsByConfidence?.());
      case TYPE.SELECTION_ELEMENT:
        return textractItem;
      default:
        log.warn(
          `[getItemFirstWord] Unknown blockType: ${textractItem.blockType}`,
        );
        break;
    }
  }

  // Support "big three" list functions (words, content, items)
  if (typeof textractItem.listWords === "function") {
    return getItemFirstWord(textractItem.listWords());
  }

  if (typeof textractItem.listContent === "function") {
    return getItemFirstWord(textractItem.listContent());
  }

  // Layout supports listItems
  if (typeof textractItem.listItems === "function") {
    return getItemFirstWord(textractItem.listItems()[0]);
  }

  // Support miscellaneous functions (alphabetical)

  // RowGeneric supports listCells
  if (typeof textractItem.listCells === "function") {
    return getItemFirstWord(textractItem.listCells()[0]);
  }

  // FormGeneric supports listFields
  if (typeof textractItem.listFields === "function") {
    return getItemFirstWord(textractItem.listFields());
  }

  if (typeof textractItem.listLayoutChildren === "function") {
    return getItemFirstWord(textractItem.listLayoutChildren());
  }

  if (typeof textractItem.listLines === "function") {
    return getItemFirstWord(textractItem.listLines());
  }

  if (typeof textractItem.listResultsByConfidence === "function") {
    return getItemFirstWord(textractItem.listResultsByConfidence());
  }

  if (typeof textractItem.listRows === "function") {
    return getItemFirstWord(textractItem.listRows());
  }

  if (typeof textractItem.listSubCells === "function") {
    return getItemFirstWord(textractItem.listSubCells());
  }

  if (typeof textractItem.listTables === "function") {
    return getItemFirstWord(textractItem.listTables());
  }

  if (textractItem.id) {
    log.warn(
      `[getItemFirstWord] Unknown unexpected item: {id:${textractItem.id}}`,
    );
  } else {
    log.warn(`[getItemFirstWord] Unknown unexpected item: ${textractItem}`);
  }
  return textractItem;
};

//
//
// Export
//

export default getItemFirstWord;
