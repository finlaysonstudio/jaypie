import { TextractDocument } from "amazon-textract-response-parser";
import { readFile } from "fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import { TYPE } from "../constants.js";

// Subject
import getItemFirstLine from "../getItemFirstLine.js";

//
//
// Mock setup
//

const MOCK = {
  COMPLETE_DOCUMENT:
    "./packages/textract/src/__tests__/__fixtures__/textract.json",
};

let completeDocument;
let signaturePage;
let tablePage;

beforeAll(async () => {
  const fileBuffer = await readFile(MOCK.COMPLETE_DOCUMENT);
  completeDocument = new TextractDocument(JSON.parse(fileBuffer));
  signaturePage = completeDocument.pageNumber(29);
  tablePage = completeDocument.pageNumber(2);
});

//
//
// Helpers
//

function findAllLayoutBlockTypes(blockType) {
  const items = completeDocument.listPages().reduce((acc, page) => {
    acc.push(
      ...page.layout
        .listItems()

        .filter((item) => item.blockType === blockType),
    );
    return acc;
  }, []);
  return items;
}

//
//
// Run tests
//

describe("Get Item First Line Function", () => {
  it("Is a function", () => {
    expect(getItemFirstLine).toBeFunction();
  });
  it("Returns string input as is", () => {
    const item = "Hello, World!";
    expect(getItemFirstLine(item)).toBe(item);
  });
  describe("Features", () => {
    it.todo("Works with unknown block types");
    describe("Handles known block types", () => {
      describe("Forms", () => {
        it("Returns the first line of the form", () => {
          const item = tablePage.form;
          const firstLine = getItemFirstLine(item);
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
        });
      });
      describe("Layouts", () => {
        it("Returns the first line of the layout", () => {
          const item = tablePage.layout;
          const firstLine = getItemFirstLine(item);
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
        });
        it("Returns the first line of layout lists", () => {
          // Arrange
          const items = findAllLayoutBlockTypes(TYPE.LAYOUT_LIST);
          // Assert
          expect(items.length).toBeGreaterThan(0);
          for (const item of items) {
            const firstLine = getItemFirstLine(item);
            expect(firstLine).not.toBeString();
            expect(firstLine.id).toBeString();
          }
        });
      });
      describe("Pages", () => {
        it("Returns the first line of the page", () => {
          const item = tablePage;
          const firstLine = getItemFirstLine(item);
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
        });
      });
      describe("Signatures", () => {
        it("Signature returns itself", () => {
          const item = signaturePage.listSignatures()[0];
          const firstLine = getItemFirstLine(item);
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
          expect(firstLine.blockType).toBe(TYPE.SIGNATURE);
          expect(firstLine).toBe(item);
        });
      });
      describe("Tables", () => {
        it("Returns first line for TABLE", () => {
          const item = tablePage.listTables()[0];
          expect(item.blockType).toBe(TYPE.TABLE);
          const firstLine = getItemFirstLine(item);
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
          expect(firstLine.id).toBe("c4f87f70-b72d-49e3-a3bd-bdfe2941ab57");
        });
        it("Returns first line for TABLE_TITLE", () => {
          const item = tablePage.listTables()[0].firstTitle;
          expect(item.blockType).toBe(TYPE.TABLE_TITLE);
          const firstLine = getItemFirstLine(item);
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
          expect(firstLine.id).toBe("c4f87f70-b72d-49e3-a3bd-bdfe2941ab57");
        });
        it("Returns first line for TABLE_FOOTER", () => {
          const item = tablePage.listTables()[0].firstFooter;
          expect(item.blockType).toBe(TYPE.TABLE_FOOTER);
          const firstLine = getItemFirstLine(item);
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
        });
        it("Returns the first row if a table has no title", () => {
          // Arrange
          const table = tablePage.listTables()[0];
          const item = {
            blockType: TYPE.TABLE,
            firstTitle: null,
            listRows: () => table.listRows(),
          };
          // Act
          const firstLine = getItemFirstLine(item);
          // Assert
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
        });
        it("Returns the first footer if a table has no title and no rows?!", () => {
          // Arrange
          const table = tablePage.listTables()[0];
          const item = {
            blockType: TYPE.TABLE,
            firstTitle: null,
            listRows: () => [],
            firstFooter: table.firstFooter,
          };
          // Act
          const firstLine = getItemFirstLine(item);
          // Assert
          expect(firstLine).not.toBeString();
          expect(firstLine.id).toBeString();
        });
      });
    });
    describe("Handles common wrappers", () => {
      it("Arrays return the first item", () => {
        const item = ["Item 1", "Item 2", "Item 3"];
        const firstLine = getItemFirstLine(item);
        expect(firstLine).toBe("Item 1");
      });
      it("Strings return themselves", () => {
        const item = "Item 1";
        const firstLine = getItemFirstLine(item);
        expect(firstLine).toBe(item);
      });
    });
    describe("Handles TextractDocument", () => {
      it("Returns the first line of a document", () => {
        const firstLine = getItemFirstLine(completeDocument);
        expect(firstLine).not.toBeString();
        expect(firstLine.id).toBeString();
        expect(firstLine.text).toContain("LEASE");
      });
    });
  });
});
