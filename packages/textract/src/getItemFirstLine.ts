import { TextractDocument } from "amazon-textract-response-parser";
import { log } from "@jaypie/core";
import { TYPE } from "./constants.js";
import { TextractItem } from "./types.js";

//
//
// Helpers
//

function getLayoutFirstLine(layout: TextractItem): TextractItem | null {
  if (typeof layout.listLayoutChildren === "function") {
    const children = layout.listLayoutChildren();
    if (children.length > 0) {
      return getItemFirstLine(children);
    }
  }
  return getItemFirstLine(layout.listContent?.() || []);
}

function getPageFirstLine(page: TextractItem): TextractItem | null {
  const lines = page.listLines?.();
  return lines ? getItemFirstLine(lines[0]) : null;
}

function getRowFirstLine(row: TextractItem): TextractItem | null {
  // Iterate over cells with listCells and return the first cell with text
  const cells = row.listCells?.();
  if (!cells) return null;

  for (const cell of cells) {
    if (cell.text) return cell;
  }
  return null;
}

function getTableFirstLine(table: TextractItem): TextractItem | null {
  // Does it have a first title?
  const firstTitle = table.firstTitle;
  if (firstTitle) {
    return getItemFirstLine(firstTitle);
  }

  // Does it have a first row?
  const firstRow = table.listRows?.()[0];
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
 * @returns {TextractItem | null} - The first line of the block content
 */
const getItemFirstLine = (
  item: TextractItem | TextractDocument | TextractItem[] | null,
): TextractItem | null => {
  if (!item) return null;
  if (Array.isArray(item)) return getItemFirstLine(item[0]);
  if (typeof item === "string") return item as unknown as TextractItem;

  // Handle TextractDocument first
  if (item instanceof TextractDocument) {
    const pages = item.listPages();
    return pages.length > 0
      ? getItemFirstLine(pages[0] as unknown as TextractItem)
      : null;
  }

  // Now item can only be TextractItem
  const textractItem = item as TextractItem;
  if (textractItem.blockType) {
    switch (textractItem.blockType) {
      // Parsable types
      case TYPE.PAGE:
        return getPageFirstLine(textractItem);
      case TYPE.TABLE:
        return getTableFirstLine(textractItem);
      case TYPE.LAYOUT_FIGURE:
      case TYPE.LAYOUT_FOOTER:
      case TYPE.LAYOUT_HEADER:
      case TYPE.LAYOUT_KEY_VALUE:
      case TYPE.LAYOUT_LIST:
      case TYPE.LAYOUT_PAGE_NUMBER:
      case TYPE.LAYOUT_SECTION_HEADER:
      case TYPE.LAYOUT_TEXT:
      case TYPE.LAYOUT_TITLE:
        return getLayoutFirstLine(textractItem);
      // Terminal types (items that are the line)
      case TYPE.KEY_VALUE_SET:
      case TYPE.LINE:
      case TYPE.TABLE_FOOTER:
      case TYPE.TABLE_TITLE:
      case TYPE.SIGNATURE:
        return textractItem;
      // null types (things without lines or smaller than a line)
      case TYPE.WORD:
        return null;
      // Incomplete types
      default:
        log.warn(
          `[getItemFirstLine] Unknown blockType: ${textractItem.blockType}`,
        );
        return undefined as unknown as TextractItem | null;
    }
  } else {
    // FormGeneric supports listFields
    if (typeof textractItem.listFields === "function") {
      return getItemFirstLine(textractItem.listFields());
    }

    // Layout supports listItems
    if (typeof textractItem.listItems === "function") {
      return getItemFirstLine(textractItem.listItems()[0]);
    }

    // RowGeneric supports listCells
    if (typeof textractItem.listCells === "function") {
      return getRowFirstLine(textractItem);
    }
  }

  if (textractItem.id) {
    log.warn(
      `[getItemFirstLine] Unknown unexpected item: {id:${textractItem.id}}`,
    );
  } else {
    log.warn(`[getItemFirstLine] Unknown unexpected item: ${textractItem}`);
  }
  return textractItem;
};

//
//
// Export
//

export default getItemFirstLine;
