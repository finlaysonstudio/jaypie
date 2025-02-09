import { TextractDocument } from "amazon-textract-response-parser";
import { log } from "jaypie";
import { TYPE } from "./constants.js";

//
//
// Helpers
//

function getLayoutFirstLine(layout) {
  if (typeof layout.listLayoutChildren === "function") {
    const children = layout.listLayoutChildren();
    if (children.length > 0) {
      return getItemFirstLine(children);
    }
  }
  return getItemFirstLine(layout.listContent());
}

function getPageFirstLine(page) {
  return getItemFirstLine(page.listLines()[0]);
}

function getRowFirstLine(row) {
  // Iterate over cells with listCells and return the first cell with
  const cells = row.listCells();
  for (const cell of cells) {
    if (cell.text) return cell;
  }
}

function getTableFirstLine(table) {
  // Does it have a first title?
  const firstTitle = table.firstTitle;
  if (firstTitle) {
    return getItemFirstLine(firstTitle);
  }

  // Does it have a first row?
  const firstRow = table.listRows()[0];
  if (firstRow) return getRowFirstLine(firstRow);

  // Does it have a first footer?
  const firstFooter = table.firstFooter;
  if (firstFooter) return getItemFirstLine(firstFooter);

  // This should never happen; a table must have _something_
  return null;
}

//
//
// Main
//

/**
 * @param {BlockGeneric|TextractDocument} item - A block from the Textract response or TextractDocument
 * @returns {string} - The first line of the block content
 */
const getItemFirstLine = (item) => {
  if (Array.isArray(item)) return getItemFirstLine(item[0]);
  if (typeof item === "string") return item;

  if (item.blockType) {
    switch (item.blockType) {
      // Parsable types
      case TYPE.PAGE:
        return getPageFirstLine(item);
      case TYPE.TABLE:
        return getTableFirstLine(item);
      case TYPE.LAYOUT_FIGURE:
      case TYPE.LAYOUT_FOOTER:
      case TYPE.LAYOUT_HEADER:
      case TYPE.LAYOUT_KEY_VALUE:
      case TYPE.LAYOUT_LIST:
      case TYPE.LAYOUT_PAGE_NUMBER:
      case TYPE.LAYOUT_SECTION_HEADER:
      case TYPE.LAYOUT_TEXT:
      case TYPE.LAYOUT_TITLE:
        return getLayoutFirstLine(item);
      // Terminal types (items that are the line)
      case TYPE.KEY_VALUE_SET:
      case TYPE.LINE:
      case TYPE.TABLE_FOOTER:
      case TYPE.TABLE_TITLE:
      case TYPE.SIGNATURE:
        return item;
      // null types (things without lines or smaller than a line)
      case TYPE.WORD:
        return null;
      // Incomplete types
      default:
        log.warn(`[getItemFirstLine] Unknown blockType: ${item.blockType}`);
        return undefined;
    }
  } else {
    // FormGeneric supports listFields
    if (typeof item.listFields === "function") {
      return getItemFirstLine(item.listFields());
    }

    // Layout supports listItems
    if (typeof item.listItems === "function") {
      return getItemFirstLine(item.listItems()[0]);
    }

    // RowGeneric supports listCells
    if (typeof item.listCells === "function") {
      return getRowFirstLine(item);
    }

    // TextractDocument supports listPages
    if (item instanceof TextractDocument) {
      return getItemFirstLine(item.listPages());
    }
  }

  if (item.id) {
    log.warn(`[getItemFirstLine] Unknown unexpected item: {id:${item.id}}`);
  } else {
    log.warn(`[getItemFirstLine] Unknown unexpected item: ${item}`);
  }
  return item;
};

//
//
// Export
//

export default getItemFirstLine;
