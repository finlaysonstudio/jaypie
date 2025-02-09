import { TextractDocument } from "amazon-textract-response-parser";
import { log } from "jaypie";
import { TYPE } from "./constants.js";

//
//
// Main
//

/**
 * Get the first word or similar "molecule sized" item (e.g., signature) from a Textract item.
 * @param item
 * @returns first word, query result, selection, or signature
 */
const getItemFirstWord = (item) => {
  if (!item) return item;
  if (typeof item === "string") return item.split(" ")[0];
  // If item is an array, return the first item that has a first word
  if (Array.isArray(item)) {
    return item.reduce((acc, subject) => {
      if (acc) return acc;
      return getItemFirstWord(subject);
    }, undefined);
  }

  if (item.blockType) {
    switch (item.blockType) {
      case TYPE.CELL:
        return getItemFirstWord(item.listContent());
      case TYPE.KEY_VALUE_SET:
        if (typeof item.listWords === "function") {
          return getItemFirstWord(item.listWords());
        }
        return getItemFirstWord(item.key);
      case TYPE.LAYOUT_FIGURE:
        return getItemFirstWord(item.listContent());
      case TYPE.LAYOUT_FOOTER:
        return getItemFirstWord(item.listContent());
      case TYPE.LAYOUT_HEADER:
        return getItemFirstWord(item.listContent());
      case TYPE.LAYOUT_KEY_VALUE:
        return getItemFirstWord(item.listContent());
      case TYPE.LAYOUT_LIST:
        // eslint-disable-next-line no-case-declarations
        const children = item.listLayoutChildren();
        if (children.length > 0) {
          return getItemFirstWord(children);
        }
        return getItemFirstWord(item.listContent());
      case TYPE.LAYOUT_PAGE_NUMBER:
        return getItemFirstWord(item.listContent());
      case TYPE.LAYOUT_SECTION_HEADER:
        return getItemFirstWord(item.listContent());
      case TYPE.LAYOUT_TABLE:
        // LayoutTable supports listTables
        return getItemFirstWord(item.listTables());
      case TYPE.LAYOUT_TEXT:
        return getItemFirstWord(item.listContent());
      case TYPE.LAYOUT_TITLE:
        return getItemFirstWord(item.listContent());
      case TYPE.LINE:
        return getItemFirstWord(item.listWords());
      case TYPE.MERGED_CELL:
        return getItemFirstWord(item.listSubCells());
      case TYPE.PAGE:
        return getItemFirstWord(item.listLines());
      case TYPE.SIGNATURE:
        return item;
      case TYPE.TABLE:
        return item.firstTitle
          ? getItemFirstWord(item.firstTitle)
          : getItemFirstWord(item.listRows());
      case TYPE.TABLE_FOOTER:
        return getItemFirstWord(item.listWords());
      case TYPE.TABLE_TITLE:
        return getItemFirstWord(item.listWords());
      case TYPE.TITLE:
        log.warn(`Known but undocumented blockType: ${item.blockType}`);
        break;
      case TYPE.WORD:
        return item;
      case TYPE.QUERY_RESULT:
        return item;
      case TYPE.QUERY:
        return getItemFirstWord(item.listResultsByConfidence());
      case TYPE.SELECTION_ELEMENT:
        return item;
      default:
        log.warn(`[getItemFirstWord] Unknown blockType: ${item.blockType}`);
        break;
    }
  }

  // Support "big three" list functions (words, content, items)

  if (typeof item.listWords === "function") {
    return getItemFirstWord(item.listWords());
  }

  if (typeof item.listContent === "function") {
    return getItemFirstWord(item.listContent());
  }

  // Layout supports listItems
  if (typeof item.listItems === "function") {
    return getItemFirstWord(item.listItems()[0]);
  }

  // Support miscellaneous functions (alphabetical)

  // RowGeneric supports listCells
  if (typeof item.listCells === "function") {
    return getItemFirstWord(item.listCells()[0]);
  }

  // FormGeneric supports listFields
  if (typeof item.listFields === "function") {
    return getItemFirstWord(item.listFields());
  }

  if (typeof item.listLayoutChildren === "function") {
    return getItemFirstWord(item.listLayoutChildren());
  }

  if (typeof item.listLines === "function") {
    return getItemFirstWord(item.listLines());
  }

  if (typeof item.listResultsByConfidence === "function") {
    return getItemFirstWord(item.listResultsByConfidence());
  }

  if (typeof item.listRows === "function") {
    return getItemFirstWord(item.listRows());
  }

  if (typeof item.listSubCells === "function") {
    return getItemFirstWord(item.listSubCells());
  }

  if (typeof item.listTables === "function") {
    return getItemFirstWord(item.listTables());
  }

  // TextractDocument supports listPages
  if (item instanceof TextractDocument) {
    return getItemFirstWord(item.listPages());
  }

  if (item.id) {
    log.warn(`[getItemFirstWord] Unknown unexpected item: {id:${item.id}}`);
  } else {
    log.warn(`[getItemFirstWord] Unknown unexpected item: ${item}`);
  }
  return item;
};

//
//
// Export
//

export default getItemFirstWord;
