import { log } from "@jaypie/core";
import getItemContent from "./getItemContent.function.js";
import getItemFirstWord from "./getItemFirstWord.js";

//
//
// Helpers
//

const TEXTRACT = {
  RELATIONSHIP: {
    CHILD: "CHILD",
    VALUE: "VALUE",
  },
};

function getTableWordIds(table) {
  const wordIds = [];
  table.listTitles().forEach((title) => {
    const titleWordIds = title.listWords();
    titleWordIds.forEach((word) => {
      wordIds.push(word.id);
    });
  });
  table.listRows().forEach((row) => {
    row.listCells().forEach((cell) => {
      cell.listContent().forEach((word) => {
        wordIds.push(word.id);
      });
    });
  });
  return wordIds;
}

/**
 * Creates an index of elements, ids, and tables from a Textract page
 * * `element`: Map of block types to block ids of block data
 * * `id`: Map of block ids to block types
 * * `table`: Map of block types to block ids of table data
 * @param {import("amazon-textract-response-parser").Page} page - The Textract page to index
 * @returns {{
 *   element: {[blockType: string]: {[id: string]: {
 *     id: string,
 *     type: string,
 *     children?: string[]
 *   }}},
 *   id: {[id: string]: string},
 * }} Index object containing elements by block type, id mappings, and tables
 */
function initIndexObject(page) {
  const element = {};
  const id = {};
  const tableFirstWord = {};
  if (!page) return { element, id };
  // Create ids
  page.listBlocks().forEach((block) => {
    id[block.Id] = block.BlockType;
  });
  // Create elements
  page.listBlocks().forEach((block) => {
    if (!element[block.BlockType]) element[block.BlockType] = {};
    element[block.BlockType][block.Id] = {
      id: block.Id,
      type: block.BlockType,
    };
    if (block.Relationships) {
      element[block.BlockType][block.Id].children = [];
      block.Relationships.forEach((relationship) => {
        if (relationship.Type === TEXTRACT.RELATIONSHIP.CHILD) {
          relationship.Ids.forEach((childId) => {
            element[block.BlockType][block.Id].children.push(childId);
          });
        }
      });
    }
  });
  // Index tables by first line id
  page.listTables().forEach((table) => {
    tableFirstWord[getItemFirstWord(table).id] = table;
  });
  // Return
  return { element, id, tableFirstWord };
}

//
//
// Class
//

export default class Page {
  constructor(page) {
    this._page = page;
    this._index = initIndexObject(page);
  }

  // Ghost text exposes raw _page.text
  get _text() {
    return this._page.text;
  }

  /**
   * @returns {string} - Markdown-aspiring text
   */
  get text() {
    const metadata = {
      type: "page",
      id: this._page.id.slice(0, 8),
    };
    const layoutItems = this._page.layout.listItems();
    const renderItems = [];
    const returnedIds = [this._page.id]; // Start with the page ID itself
    const signatures = this._page.listSignatures();

    // Preprocess
    if (signatures.length > 0) {
      signatures.forEach((signature) => {
        returnedIds.push(signature.id);
      });
      metadata.signatures = signatures.length;
    }

    // Process
    const frontMatter = Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n");
    renderItems.push(`---\n${frontMatter}\n---`);
    const tableWordIds = [];
    layoutItems.forEach((item) => {
      const itemFirstWord = getItemFirstWord(item);
      if (itemFirstWord) {
        returnedIds.push(item.id);
        if (this._index.tableFirstWord[itemFirstWord.id]) {
          const table = this._index.tableFirstWord[itemFirstWord.id];
          tableWordIds.push(...getTableWordIds(table));
          returnedIds.push(table.id);
          renderItems.push(table);
        } else {
          if (tableWordIds.includes(itemFirstWord.id)) {
            return;
          }
          renderItems.push(item);
        }
      } else {
        log.warn(`[textract] Item with no first word: ${item.id}`);
      }
    });
    const content = renderItems
      .map((item) => getItemContent(item, { returnedIds }))
      .join("\n\n");

    // Postprocess
    const missingIds = Object.keys(this._index.id).filter(
      (id) => !returnedIds.includes(id),
    );
    const missingIgnoreIds = [];
    for (const id of missingIds) {
      const item = this._page.getItemByBlockId(id);
      // Get all the content from this item...
      const idsFromMissingItem = [];
      getItemContent(item, {
        returnedIds: idsFromMissingItem,
      });
      const missingIdsFromMissingItem = idsFromMissingItem.filter(
        (i) => !returnedIds.includes(i),
      );
      // ...If all the returned ids are in the index and not missing, everything is okay.
      if (missingIdsFromMissingItem.length === 0) {
        // All the content is included so we can ignore this "empty container"
        missingIgnoreIds.push(id);
      } else {
        // This item _is_ missing something and should be left in missingIds
      }
    }
    // Remove the missingIgnoreIds from missingIds
    const warnIds = missingIds.filter((id) => !missingIgnoreIds.includes(id));
    // If there are still missingIds, log them
    if (warnIds.length > 0) {
      // eslint-disable-next-line no-console
      console.warn("[textract] Incomplete JSON to markdown conversion");
      log.warn("[textract] Incomplete JSON to markdown conversion");
      log.var({
        missingIds: {
          length: warnIds.length,
          ids: warnIds,
        },
      });
    }

    // Return
    return content;
  }

  get _layout() {
    return this._page.layout; // LayoutGeneric from amazon-textract-response-parser
  }
}
