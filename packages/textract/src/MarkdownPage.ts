import { log } from "@jaypie/core";
import getItemContent from "./getItemContent.js";
import getItemFirstWord from "./getItemFirstWord.js";
import { TextractItem, TextractPage, IndexObject } from "./types.js";

const TEXTRACT = {
  RELATIONSHIP: {
    CHILD: "CHILD",
    VALUE: "VALUE",
  },
} as const;

/**
 * Compare the first word of multiple Textract items
 * @param items - The items to compare
 * @returns true if all items have the same first word, false otherwise
 */
function sameFirstWord(...items: TextractItem[]): boolean {
  if (items.length < 2) return true;

  const firstWords = items.map((item) => {
    const firstWord = getItemFirstWord(item);
    return firstWord && typeof firstWord === "object" && "id" in firstWord
      ? firstWord.id
      : firstWord;
  });

  const firstId = firstWords[0];
  return firstWords.every((id) => id === firstId);
}

function getTableWordIds(table: TextractItem): string[] {
  const wordIds: string[] = [];

  table.listTitles?.()?.forEach((title) => {
    const titleWordIds = title.listWords?.();
    titleWordIds?.forEach((word) => {
      wordIds.push(word.id);
    });
  });

  table.listRows?.()?.forEach((row) => {
    row.listCells?.()?.forEach((cell) => {
      cell.listContent?.()?.forEach((word) => {
        wordIds.push(word.id);
      });
    });
  });

  return wordIds;
}

function initIndexObject(page: TextractPage | null): IndexObject {
  const element: IndexObject["element"] = {};
  const id: IndexObject["id"] = {};
  const tableFirstWord: IndexObject["tableFirstWord"] = {};

  if (!page) return { element, id, tableFirstWord };

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
            element[block.BlockType][block.Id].children?.push(childId);
          });
        }
      });
    }
  });

  // Index tables by first line id
  page.listTables().forEach((table) => {
    const firstWord = getItemFirstWord(table);
    if (firstWord && typeof firstWord === "object" && "id" in firstWord) {
      tableFirstWord[firstWord.id] = table;
    }
  });

  return { element, id, tableFirstWord };
}

export default class MarkdownPage {
  private _page: TextractPage;
  private _index: IndexObject;

  constructor(page: TextractPage) {
    this._page = page;
    this._index = initIndexObject(page);
  }

  get _text(): string {
    return this._page.text;
  }

  get text(): string {
    const metadata: { type: string; id: string; signatures?: number } = {
      type: "page",
      id: this._page.id.slice(0, 8),
    };

    const layoutItems = this._page.layout.listItems();
    const renderItems: TextractItem[] = [];
    const returnedIds: string[] = [this._page.id];
    const renderedIds: string[] = [this._page.id];
    const signatures = this._page.listSignatures();
    const lines = this._page.listLines();

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
    renderItems.push(`---\n${frontMatter}\n---` as unknown as TextractItem);

    const tableWordIds: string[] = [];
    let lineIndex = 0;
    let printed = false;
    console.log("layoutItems.length :>> ", layoutItems.length);
    console.log("lines.length :>> ", lines.length);
    for (const item of layoutItems) {
      let line = lines[lineIndex];
      const itemFirstWord = getItemFirstWord(item);
      let same = sameFirstWord(item, line);
      if (same) {
        console.log("sameFirstWord:", itemFirstWord.text);
        lineIndex++;
      } else {
        // Find out if line is already part of renderItems
        // console.log(itemFirstWord.text, " <> ", line.text);
        if (!printed) {
          // console.log(
          //   "renderedIds :>> ",
          //   renderedIds.map((id) => this._page.getItemByBlockId(id).text),
          // );
          console.log("Bad line?:", line.text);
          if (renderedIds.includes(line.id)) {
            console.log("Found:", line.text);
          } else {
            console.log("Missing:", line.text);
            const words = line.listWords();
            words.forEach((word) => {
              if (renderedIds.includes(word.id)) {
                console.log("Found:", word.text);
              } else {
                console.log("Missing:", word.text);
              }
            });
          }
          printed = true;
        }
      }
      if (
        itemFirstWord &&
        typeof itemFirstWord === "object" &&
        "id" in itemFirstWord
      ) {
        returnedIds.push(item.id);
        if (itemFirstWord.id && this._index.tableFirstWord[itemFirstWord.id]) {
          const table = this._index.tableFirstWord[itemFirstWord.id];
          tableWordIds.push(...getTableWordIds(table));
          returnedIds.push(table.id);
          renderItems.push(table);
          renderedIds.push(table.id);
          getItemContent(table, {
            returnedIds: renderedIds,
          });
        } else {
          if (itemFirstWord.id && tableWordIds.includes(itemFirstWord.id)) {
            continue;
          }
          renderItems.push(item);
          renderedIds.push(item.id);
          getItemContent(item, {
            returnedIds: renderedIds,
          });
        }
      } else {
        log.warn(`[textract] Item with no first word: ${item.id}`);
      }
    }

    const content = renderItems
      .map((item) => getItemContent(item, { returnedIds }))
      .join("\n\n");

    // Postprocess
    const missingIds = Object.keys(this._index.id).filter(
      (id) => !returnedIds.includes(id),
    );
    const missingIgnoreIds: string[] = [];

    for (const id of missingIds) {
      const item = this._page.getItemByBlockId(id);
      const idsFromMissingItem: string[] = [];

      getItemContent(item, {
        returnedIds: idsFromMissingItem,
      });

      const missingIdsFromMissingItem = idsFromMissingItem.filter(
        (i) => !returnedIds.includes(i),
      );

      if (missingIdsFromMissingItem.length === 0) {
        missingIgnoreIds.push(id);
      }
    }

    const warnIds = missingIds.filter((id) => !missingIgnoreIds.includes(id));

    if (warnIds.length > 0) {
      console.warn("[textract] Incomplete JSON to markdown conversion");
      log.warn("[textract] Incomplete JSON to markdown conversion");
      log.var({ missingIds: warnIds.length });
    }

    return content;
  }

  get _layout() {
    return this._page.layout;
  }
}
