import { force, log } from "@jaypie/core";
import { TYPE, WORD } from "./constants.js";
import { TextractItem, GetItemContentOptions } from "./types.js";

const normalizeWhitespace = (input: string): string => {
  return input.replace(/\s+/g, " ").trim();
};

const idsArrayHasItem = (ids: string[], item: unknown): boolean => {
  ids = force.array(ids);
  if (typeof item !== "object" || !item) {
    return false;
  }
  if (!("id" in item) || typeof (item as { id: unknown }).id !== "string") {
    return false;
  }
  return ids.includes((item as { id: string }).id);
};

//
//
// Helper Functions
//

function getAbstract(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  returnedIds = force.array(returnedIds);
  // Does it implement WithContent?
  if (typeof item.listContent === "function") {
    const content = item.listContent().map((myItem) => {
      returnedIds.push(myItem.id);
      return getItemContent(myItem, { returnedIds });
    });
    return content.join("\n");
  }
  // Does it implement WithWords?
  if (typeof item.listWords === "function") {
    const content = item.listWords().map((myItem) => {
      if (ignoreWords && idsArrayHasItem(returnedIds, myItem)) {
        return;
      }
      returnedIds.push(myItem.id);
      return getItemContent(myItem, { returnedIds });
    });
    return content.filter(Boolean).join(" ");
  }
  // Desperate measures
  try {
    return item.str?.() || "";
  } catch (error) {
    log.error.var({ error });
    if (typeof item.toString === "function") {
      return item.toString();
    }
    return String(item);
  }
}

function getKeyValueSetContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  // TODO: Dig into this more. Does it have separate key and value?
  return getAbstract(item, { ignoreWords, returnedIds });
}

function getLayoutFigureContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  returnedIds = force.array(returnedIds);
  const alt =
    item.listContent?.()?.map((line) => {
      returnedIds.push(line.id);
      return getItemContent(line, { ignoreWords, returnedIds });
    }) || [];
  const altText = alt.join(" ");
  const idChunk = item.id.slice(0, 8);
  if (!altText) {
    return `![Figure: (No OCR Text)](figure-${idChunk}.jpg)`;
  }
  return `![Figure: "${altText}" (OCR Text)](figure-${idChunk}.jpg)`;
}

function getLayoutHeaderContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  returnedIds = force.array(returnedIds);
  return (
    item.listContent?.()?.map((line) => {
      returnedIds.push(line.id);
      return `## ${getItemContent(line, { ignoreWords, returnedIds })}`;
    }) || []
  ).join("\n");
}

function getLayoutKeyValueContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  return (
    item.listContent?.()?.map((myItem) => {
      returnedIds.push(myItem.id);
      return getItemContent(myItem, { ignoreWords, returnedIds });
    }) || []
  ).join("\n");
}

function getLayoutPageNumberContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  const pageNumber = (
    item.listTextLines?.()?.map((myItem) => {
      returnedIds.push(myItem.id);
      return getItemContent(myItem, { ignoreWords, returnedIds });
    }) || []
  ).join("\n");
  return `--${JSON.stringify({ pageNumber })}--`;
}

function getLayoutTextContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  return (
    item.listContent?.()?.map((myItem) => {
      returnedIds.push(myItem.id);
      return getItemContent(myItem, { ignoreWords, returnedIds });
    }) || []
  ).join("\n");
}

function getLineContent(
  line: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  returnedIds = force.array(returnedIds);
  // Build list of phrases (most will be all "printed")
  const phrases: Array<{ text: string; type: string | null }> = [];
  let currentPhrase = {
    text: "",
    type: null as string | null,
  };

  line.listWords?.()?.forEach((word) => {
    if (ignoreWords && idsArrayHasItem(returnedIds, word)) {
      return;
    }
    if (!currentPhrase.type) {
      currentPhrase.type = word.textType || null;
    }
    if (currentPhrase.type !== word.textType) {
      phrases.push(currentPhrase);
      currentPhrase = {
        text: "",
        type: word.textType || null,
      };
    }
    if (currentPhrase.text) {
      currentPhrase.text += " ";
    }
    returnedIds.push(word.id);
    currentPhrase.text += word.text.trim();
  });

  if (currentPhrase.text) {
    phrases.push(currentPhrase);
  }

  // Convert phrases back to lines but call out handwriting
  const lineText = phrases.reduce((acc, phrase) => {
    if (acc) {
      acc += " ";
    }
    if (phrase.type === WORD.HANDWRITING) {
      acc += `--${JSON.stringify({ handwriting: phrase.text })}--`;
    } else {
      acc += phrase.text;
    }
    return acc;
  }, "");

  return lineText;
}

function getSignatureContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  return getAbstract(item, { ignoreWords, returnedIds });
}

function getTableContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  returnedIds = force.array(returnedIds);
  const content: string[] = [];

  // Handle rows
  const table =
    item.listRows?.()?.map((row) => {
      let rowText = "| ";
      rowText += (
        row.listCells?.()?.map((cell) => {
          returnedIds.push(cell.id);
          if (cell.nSubCells > 0) {
            return cell
              .listSubCells?.()
              ?.map((subCell) => {
                returnedIds.push(subCell.id);
                return normalizeWhitespace(
                  getItemContent(subCell, {
                    ignoreWords,
                    returnedIds,
                  }),
                );
              })
              .join(" | ");
          }
          return normalizeWhitespace(
            getItemContent(cell, {
              ignoreWords,
              returnedIds,
            }),
          );
        }) || []
      ).join(" | ");
      rowText += " |";
      return rowText;
    }) || [];

  content.push(table.join("\n"));

  // Handle titles
  const titles =
    item.listTitles?.()?.map((title) => {
      returnedIds.push(title.id);
      return `# ${getItemContent(title, { ignoreWords: true, returnedIds })}`;
    }) || [];

  if (titles.length > 0) {
    content.unshift(titles.join("\n"));
  }

  // Handle footers
  const footers =
    item.listFooters?.()?.map((footer) => {
      returnedIds.push(footer.id);
      const footerWordIds = footer.listWords?.()?.map((word) => word.id) || [];
      const pageLines = item.parentPage?.listLines() || [];
      const footerLines: TextractItem[] = [];

      pageLines.forEach((line) => {
        const lineWordIds = line.listWords?.()?.map((word) => word.id) || [];
        const lineHasFooterWords = lineWordIds.some((wordId) =>
          footerWordIds.includes(wordId),
        );
        if (lineHasFooterWords) {
          footerLines.push(line);
          const lineHasAllFooterWords = lineWordIds.every((wordId) =>
            footerWordIds.includes(wordId),
          );
          if (!lineHasAllFooterWords) {
            log.warn(`[textract] Partial footer line ${line.id}`);
          }
        }
      });

      return footerLines
        .map((line) => {
          returnedIds.push(line.id);
          return getItemContent(line, { ignoreWords, returnedIds });
        })
        .join("\n");
    }) || [];

  if (footers.length > 0) {
    content.push(footers.join("\n"));
  }

  return content.join("\n");
}

function getTitleContent(
  item: TextractItem,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string {
  returnedIds = force.array(returnedIds);
  return (
    item.listContent?.()?.map((line) => {
      returnedIds.push(line.id);
      return `# ${getItemContent(line, { ignoreWords, returnedIds })}`;
    }) || []
  ).join("\n");
}

//
//
// Main
//

const getItemContent = (
  item: TextractItem | string,
  { ignoreWords = false, returnedIds = [] }: GetItemContentOptions = {},
): string => {
  if (typeof item === "string") return item;

  // TODO: warn if called without returnedIds
  try {
    if (item.blockType) {
      switch (item.blockType) {
        case TYPE.KEY_VALUE_SET:
          return getKeyValueSetContent(item, { returnedIds });
        case TYPE.LAYOUT_FIGURE:
          return getLayoutFigureContent(item, { returnedIds });
        case TYPE.LAYOUT_HEADER:
          return getLayoutHeaderContent(item, { returnedIds });
        case TYPE.LAYOUT_KEY_VALUE:
          return getLayoutKeyValueContent(item, { returnedIds });
        case TYPE.LAYOUT_PAGE_NUMBER:
          return getLayoutPageNumberContent(item, { returnedIds });
        case TYPE.LAYOUT_TEXT:
          return getLayoutTextContent(item, { returnedIds });
        case TYPE.LAYOUT_TITLE:
          return getTitleContent(item, { returnedIds });
        case TYPE.LINE:
          return getLineContent(item, { returnedIds });
        case TYPE.SIGNATURE:
          return getSignatureContent(item, { returnedIds });
        case TYPE.TABLE:
          return getTableContent(item, { returnedIds });
        case TYPE.WORD:
          if (ignoreWords) {
            return "";
          }
          returnedIds.push(item.id);
          return item.text || "";
        default:
          const content = getAbstract(item, { ignoreWords, returnedIds });
          return content;
      }
    }
  } catch (error) {
    log.error.var({ error });
  }
  try {
    return item.str?.() || "";
  } catch (error) {
    log.error.var({ error });
    if (typeof item.toString === "function") {
      return item.toString();
    }
    return String(item);
  }
};

//
//
// Export
//

export default getItemContent;
