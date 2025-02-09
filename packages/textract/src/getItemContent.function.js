import { force, log } from "jaypie";
import { TYPE, WORD } from "./constants.js";

const normalizeWhitespace = (input) => {
  return input.replace(/\s+/g, " ").trim();
};

const idsArrayHasItem = (ids, item) => {
  ids = force.array(ids);
  if (typeof item !== "object") {
    return false;
  }
  if (typeof item.id !== "string") {
    return false;
  }
  return ids.includes(item.id);
};

//
//
// Helper Functions
//

function getAbstract(item, { ignoreWords = false, returnedIds = [] } = {}) {
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
    return content.join(" ");
  }
  // Desperate measures
  try {
    return item.str();
  } catch (error) {
    log.error.var({ error });
    if (typeof item.toString === "function") {
      return item.toString();
    }
    return String(item);
  }
}

function getKeyValueSetContent(
  item,
  { ignoreWords = false, returnedIds = [] } = {},
) {
  // TODO: Dig into this more. Does it have separate key and value?
  return getAbstract(item, { ignoreWords, returnedIds });
}

function getLayoutFigureContent(
  item,
  { ignoreWords = false, returnedIds = [] } = {},
) {
  returnedIds = force.array(returnedIds);
  const alt = item.listContent().map((line) => {
    returnedIds.push(line.id);
    return getItemContent(line, { ignoreWords, returnedIds });
  });
  const altText = alt.join(" ");
  const idChunk = item.id.slice(0, 8);
  if (!altText) {
    return `![Figure: (No OCR Text)](figure-${idChunk}.jpg)`;
  }
  return `![Figure: "${altText}" (OCR Text)](figure-${idChunk}.jpg)`;
}

/**
 * @param {LayoutHeaderGeneric} item
 * @param {object} options - Options for the function
 * @param {String[]} options.returnedIds - Reference to empty array which, as a side effect, will be populated with the IDs of the blocks that were used to generate the content
 * @returns {string} - The content of the block
 */
function getLayoutHeaderContent(
  item,
  { ignoreWords = false, returnedIds = [] } = {},
) {
  returnedIds = force.array(returnedIds);
  return item
    .listContent()
    .map((line) => {
      returnedIds.push(line.id);
      return `## ${getItemContent(line, { ignoreWords, returnedIds })}`;
    })
    .join("\n");
}

/**
 * @param {LayoutKeyValueGeneric} item
 * @returns {string}
 */
function getLayoutKeyValueContent(
  item,
  { ignoreWords = false, returnedIds = [] } = {},
) {
  return item
    .listContent()
    .map((myItem) => {
      returnedIds.push(myItem.id);
      return getItemContent(myItem, { ignoreWords, returnedIds });
    })
    .join("\n");
}

/**
 * @param {LayoutPageNumberGeneric} item
 * @returns {string}
 */
function getLayoutPageNumberContent(
  item,
  { ignoreWords = false, returnedIds = [] } = {},
) {
  // This line looks gnarly but there will never be more than one line in the page number container
  const pageNumber = item
    .listTextLines()
    .map((myItem) => {
      returnedIds.push(myItem.id);
      return getItemContent(myItem, { ignoreWords, returnedIds });
    })
    .join("\n");
  return `--${JSON.stringify({ pageNumber })}--`;
}

/**
 * @param {LayoutTextGeneric} item
 * @returns {string}
 */
function getLayoutTextContent(
  item,
  { ignoreWords = false, returnedIds = [] } = {},
) {
  return item
    .listContent()
    .map((myItem) => {
      returnedIds.push(myItem.id);
      return getItemContent(myItem, { ignoreWords, returnedIds });
    })
    .join("\n");
}

/**
 * @param {LineGeneric} item
 * @returns {string}
 */
function getLineContent(line, { ignoreWords = false, returnedIds = [] } = {}) {
  returnedIds = force.array(returnedIds);
  // Build list of phrases (most will be all "printed")
  const phrases = [];
  let currentPhrase = {
    text: "",
    type: null,
  };
  line.listWords().forEach((word) => {
    if (ignoreWords && idsArrayHasItem(returnedIds, word)) {
      return;
    }
    if (!currentPhrase.type) {
      currentPhrase.type = word.textType;
    }
    if (currentPhrase.type !== word.textType) {
      phrases.push(currentPhrase);
      currentPhrase = {
        text: "",
        type: word.textType,
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
  item,
  { ignoreWords = false, returnedIds = [] } = {},
) {
  return getAbstract(item, { ignoreWords, returnedIds });
}

/**
 * @param {TableGeneric} item
 * @param {object} options - Options for the function
 * @param {String[]} options.returnedIds - Reference to empty array which, as a side effect, will be populated with the IDs of the blocks that were used to generate the content
 * @returns {string} - The content of the block
 */
function getTableContent(item, { ignoreWords = false, returnedIds = [] } = {}) {
  returnedIds = force.array(returnedIds);
  const content = [];

  // Handle rows
  const table = item.listRows().map((row) => {
    let rowText = "| ";
    rowText += row
      .listCells()
      .map((cell) => {
        returnedIds.push(cell.id);
        if (cell.nSubCells > 0) {
          return cell
            .listSubCells()
            .map((subCell) => {
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
      })
      .join(" | ");
    rowText += " |";
    return rowText;
  });
  content.push(table.join("\n"));

  // Handle titles
  const titles = item.listTitles().map((title) => {
    returnedIds.push(title.id);
    return `# ${getItemContent(title, { ignoreWords: true, returnedIds })}`;
  });
  if (titles.length > 0) {
    content.unshift(titles.join("\n"));
  }

  // Handle footers
  const footers = item.listFooters().map((footer) => {
    returnedIds.push(footer.id);
    const footerWordIds = footer.listWords().map((word) => word.id);
    const pageLines = item.parentPage.listLines();
    const footerLines = [];
    // Go through all the page lines
    // see if each line has a footer word
    // if it does, push the line
    // if it is not _all_ footer words, log a warning
    pageLines.forEach((line) => {
      const lineWordIds = line.listWords().map((word) => word.id);
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
  });
  if (footers.length > 0) {
    content.push(footers.join("\n"));
  }

  return content.join("\n");
}

/**
 * @param {LayoutTitleGeneric} item
 * @param {object} options - Options for the function
 * @param {String[]} options.returnedIds - Reference to empty array which, as a side effect, will be populated with the IDs of the blocks that were used to generate the content
 * @returns {string} - The content of the block
 */
function getTitleContent(item, { ignoreWords = false, returnedIds = [] } = {}) {
  returnedIds = force.array(returnedIds);
  return item
    .listContent()
    .map((line) => {
      returnedIds.push(line.id);
      return `# ${getItemContent(line, { ignoreWords, returnedIds })}`;
    })
    .join("\n");
}

//
//
// Main
//

/**
 * @param {BlockGeneric} item - A block from the Textract response
 * @param {object} options - Options for the function
 * @param {String[]} options.returnedIds - Reference to empty array which, as a side effect, will be populated with the IDs of the blocks that were used to generate the content
 * * returnedIds will NOT include the original item ID
 * @returns {string} - The content of the block
 */
const getItemContent = (
  item,
  { ignoreWords = false, returnedIds = [] } = {},
) => {
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
            return;
          }
          returnedIds.push(item.id);
          return item.text;
        default:
          // log.warn.var({ unknownBlockType: item.blockType });
          // eslint-disable-next-line no-case-declarations
          const content = getAbstract(item, { ignoreWords, returnedIds });
          // log.debug.var({ item: content });
          return content;
      }
    }
  } catch (error) {
    log.error.var({ error });
  }
  try {
    return item.str();
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

// * Helpful documentation / source code:
// * https://github.com/aws-samples/amazon-textract-response-parser/blob/master/src-js/README.md
// * https://github.com/aws-samples/amazon-textract-response-parser/blob/master/src-js/src/content.ts
// * https://github.com/aws-samples/amazon-textract-response-parser/blob/master/src-js/src/layout.ts
