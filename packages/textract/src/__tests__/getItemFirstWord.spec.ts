import { TextractDocument } from "amazon-textract-response-parser";
import { readFile } from "fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import { TYPE } from "../constants.js";
import { TextractItem } from "../types.js";

// Subject
import getItemFirstWord from "../getItemFirstWord.js";

//
//
// Mock modules
//

const MOCK = {
  COMPLETE_DOCUMENT:
    "./packages/textract/src/__tests__/__fixtures__/textract.json",
};

let completeDocument: TextractDocument;
let signaturePage: any;
let tablePage: any;

beforeAll(async () => {
  const fileBuffer = await readFile(MOCK.COMPLETE_DOCUMENT);
  completeDocument = new TextractDocument(JSON.parse(fileBuffer.toString()));
  signaturePage = completeDocument.pageNumber(29);
  tablePage = completeDocument.pageNumber(2);
});

//
//
// Run tests
//

describe("Get Item First Word Function", () => {
  it("Is a function", () => {
    expect(getItemFirstWord).toBeFunction();
  });
  describe("Features", () => {
    describe("Handles undesired types gracefully", () => {
      it("Returns string input first item before space", () => {
        const item = "Hello, World!";
        expect(getItemFirstWord(item as unknown as TextractItem)).toBe(
          "Hello,",
        );
      });
      it("Returns falsy for falsy input", () => {
        expect(getItemFirstWord(null)).toBeNull();
        expect(getItemFirstWord(undefined)).toBeUndefined();
      });
      it("When given an array, loop through the array until the first one is not falsy", () => {
        const item = [undefined, null, "Hello, World!"];
        expect(getItemFirstWord(item as unknown as TextractItem[])).toBe(
          "Hello,",
        );
      });
    });
    describe("Handles known block types", () => {
      it("Returns first word for a document", () => {
        const firstWord = getItemFirstWord(completeDocument);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("LEASE");
        }
      });
      it("Returns first word for a page", () => {
        const firstWord = getItemFirstWord(
          completeDocument.pageNumber(1) as unknown as TextractItem,
        );
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("LEASE");
        }
      });
      it("Returns first word for page.layout", () => {
        const item = tablePage.layout;
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("INDEX");
        }
      });
      it("Returns first word for LayoutTextGeneric", () => {
        const item = tablePage.layout.listItems()[1];
        expect(item.blockType).toBe(TYPE.LAYOUT_TEXT);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("SECTION");
        }
      });
      it("Returns first word for LayoutFooterGeneric", () => {
        const items = tablePage.layout.listItems();
        const item = items[items.length - 1];
        expect(item.blockType).toBe(TYPE.LAYOUT_FOOTER);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("EXHIBIT");
        }
      });
      it("Returns first word for TABLE", () => {
        const item = tablePage.listTables()[0];
        expect(item.blockType).toBe(TYPE.TABLE);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("INDEX");
        }
      });
      it("Returns first word for table rows", () => {
        const item = tablePage.listTables()[0].listRows()[0];
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("SECTION");
        }
      });
      it("Returns first word for table footers", () => {
        const firstWord = getItemFirstWord(
          tablePage.listTables()[0].listFooters() as unknown as TextractItem[],
        );
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("EXHIBIT");
        }
      });
      it("Returns first word of a form", () => {
        const firstWord = getItemFirstWord(
          tablePage.form as unknown as TextractItem,
        );
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("3.");
        }
      });
      it("Returns first word of a form field", () => {
        const item = tablePage.form.listFields()[0];
        expect(item.blockType).toBe(TYPE.KEY_VALUE_SET);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("3.");
        }
      });
      it("Returns first word of a form field key", () => {
        const item = tablePage.form.listFields()[0].key;
        expect(item.blockType).toBe(TYPE.KEY_VALUE_SET);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("3.");
        }
      });
      it("Returns the first words of a figure", () => {
        const item = signaturePage.layout
          .listItems()
          .filter(
            (item: TextractItem) => item.blockType === TYPE.LAYOUT_FIGURE,
          )[0];
        expect(item.blockType).toBe(TYPE.LAYOUT_FIGURE);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
        }
      });
      it("Returns the first word of a signature", () => {
        const firstWord = getItemFirstWord(
          signaturePage.listSignatures() as unknown as TextractItem[],
        );
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.SIGNATURE);
        }
      });
      it("Returns the first word of a page number", () => {
        const item = signaturePage.layout
          .listItems()
          .filter(
            (item: TextractItem) => item.blockType === TYPE.LAYOUT_PAGE_NUMBER,
          )[0];
        expect(item.blockType).toBe(TYPE.LAYOUT_PAGE_NUMBER);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).not.toBe("");
        }
      });
      it("Returns the first word of a layout header", () => {
        const item = signaturePage.layout
          .listItems()
          .filter(
            (item: TextractItem) => item.blockType === TYPE.LAYOUT_HEADER,
          )[0];
        expect(item.blockType).toBe(TYPE.LAYOUT_HEADER);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).not.toBe("");
        }
      });
      it("Returns the first word of a layout key-value", () => {
        const item = signaturePage.layout
          .listItems()
          .filter(
            (item: TextractItem) => item.blockType === TYPE.LAYOUT_KEY_VALUE,
          )[0];
        expect(item.blockType).toBe(TYPE.LAYOUT_KEY_VALUE);
        const firstWord = getItemFirstWord(item as unknown as TextractItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).not.toBe("");
        }
      });
      describe("Exhaustive Tests of All Items", () => {
        function exhaustLayoutItems({
          blockType,
          document,
        }: {
          blockType: string;
          document: TextractDocument;
        }) {
          // Arrange
          const items = document
            .listPages()
            .reduce<TextractItem[]>((acc, page) => {
              const layoutItems =
                page.layout.listItems() as unknown as TextractItem[];
              acc.push(
                ...layoutItems.filter((item) => item.blockType === blockType),
              );
              return acc;
            }, []);
          // Assure
          expect(items).toBeArray();
          expect(items.length).toBeGreaterThan(0);
          for (const item of items) {
            expect(item.blockType).toBe(blockType);
            // Act
            const firstWord = getItemFirstWord(item);
            // console.log(firstWord.blockType, " :>> ", firstWord.text);
            // Assert
            expect(firstWord).not.toBeUndefined();
            if (firstWord && typeof firstWord !== "string") {
              expect(firstWord.blockType).toBe(TYPE.WORD);
              expect(firstWord.text).not.toBe("");
            }
          }
          return true;
        }
        it("Returns the first word of all layout lists", () => {
          const result = exhaustLayoutItems({
            blockType: TYPE.LAYOUT_LIST,
            document: completeDocument,
          });
          expect(result).toBeTruthy();
        });
        it("Returns the first word of all layout section headers", () => {
          const result = exhaustLayoutItems({
            blockType: TYPE.LAYOUT_SECTION_HEADER,
            document: completeDocument,
          });
          expect(result).toBeTruthy();
        });
        it("Returns the first word of all layout tables", () => {
          const result = exhaustLayoutItems({
            blockType: TYPE.LAYOUT_TABLE,
            document: completeDocument,
          });
          expect(result).toBeTruthy();
        });
        // TODO: Find good query tests
        it.todo("Returns the first word of queries");
      });
    });
    describe("Unknown block types", () => {
      it.todo("Works with unknown block types");
    });
    describe("Handles items with list functions", () => {
      it("Returns first word from listWords", () => {
        const mockItem: TextractItem = {
          id: "mock-item",
          listWords: () => [
            {
              id: "mock-word",
              blockType: TYPE.WORD,
              text: "TestWord",
            },
          ],
        };
        const firstWord = getItemFirstWord(mockItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("TestWord");
        }
      });

      it("Returns first word from listContent", () => {
        const mockItem: TextractItem = {
          id: "mock-item",
          listContent: () => [
            {
              id: "mock-word",
              blockType: TYPE.WORD,
              text: "ContentWord",
            },
          ],
        };
        const firstWord = getItemFirstWord(mockItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("ContentWord");
        }
      });

      it("Returns first word from listLayoutChildren", () => {
        const mockItem: TextractItem = {
          id: "mock-item",
          listLayoutChildren: () => [
            {
              id: "mock-word",
              blockType: TYPE.WORD,
              text: "ChildWord",
            },
          ],
        };
        const firstWord = getItemFirstWord(mockItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("ChildWord");
        }
      });

      it("Returns first word from listTables", () => {
        const mockItem: TextractItem = {
          id: "mock-item",
          listTables: () => [
            {
              id: "mock-table",
              blockType: TYPE.TABLE,
              firstTitle: {
                id: "mock-word",
                blockType: TYPE.WORD,
                text: "TableWord",
              },
            },
          ],
        };
        const firstWord = getItemFirstWord(mockItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("TableWord");
        }
      });

      it("Returns first word from listSubCells", () => {
        const mockItem: TextractItem = {
          id: "mock-item",
          listSubCells: () => [
            {
              id: "mock-word",
              blockType: TYPE.WORD,
              text: "SubCellWord",
            },
          ],
        };
        const firstWord = getItemFirstWord(mockItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("SubCellWord");
        }
      });

      it("Returns first word from listLines", () => {
        const mockItem: TextractItem = {
          id: "mock-item",
          listLines: () => [
            {
              id: "mock-line",
              blockType: TYPE.LINE,
              listWords: () => [
                {
                  id: "mock-word",
                  blockType: TYPE.WORD,
                  text: "LineWord",
                },
              ],
            },
          ],
        };
        const firstWord = getItemFirstWord(mockItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("LineWord");
        }
      });

      it("Returns first word from listRows", () => {
        const mockItem: TextractItem = {
          id: "mock-item",
          listRows: () => [
            {
              id: "mock-row",
              listCells: () => [
                {
                  id: "mock-word",
                  blockType: TYPE.WORD,
                  text: "RowWord",
                },
              ],
            },
          ],
        };
        const firstWord = getItemFirstWord(mockItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.WORD);
          expect(firstWord.text).toBe("RowWord");
        }
      });

      it("Returns first word from listResultsByConfidence", () => {
        const mockItem: TextractItem = {
          id: "mock-item",
          listResultsByConfidence: () => [
            {
              id: "mock-result",
              blockType: TYPE.QUERY_RESULT,
              text: "QueryWord",
            },
          ],
        };
        const firstWord = getItemFirstWord(mockItem);
        expect(firstWord).not.toBeUndefined();
        if (firstWord && typeof firstWord !== "string") {
          expect(firstWord.blockType).toBe(TYPE.QUERY_RESULT);
          expect(firstWord.text).toBe("QueryWord");
        }
      });
    });
  });
});
