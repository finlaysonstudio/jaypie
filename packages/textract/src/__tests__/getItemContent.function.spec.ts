import { TextractDocument } from "amazon-textract-response-parser";
import { readFile } from "fs/promises";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { TYPE } from "../constants.js";

// Subject
import getItemContent from "../getItemContent.function.js";

//
//
// Mock setup
//

const MOCK = {
  COMPLETE_DOCUMENT:
    "./packages/textract/src/__tests__/__fixtures__/textract.json",
  SIGNATURE_PAGE:
    "./packages/textract/src/__tests__/__fixtures__/signature.json",
};

let page;

beforeAll(async () => {
  const fileBuffer = await readFile(MOCK.SIGNATURE_PAGE);
  const document = new TextractDocument(JSON.parse(fileBuffer));
  page = document.pageNumber(1);
});

//
//
// Run tests
//

describe("Get Item Content Function", () => {
  it("Is a function", () => {
    expect(getItemContent).toBeFunction();
  });
  it("Works", () => {
    const item = {
      str: vi.fn().mockReturnValue("Hello, World!"),
    };
    expect(getItemContent(item)).toBe("Hello, World!");
  });
  describe("Error Conditions", () => {
    it("Will attempt to resolve if an error is thrown", () => {
      // Arrange
      const item = {
        blockType: TYPE.LINE,
        listWords: vi.fn().mockImplementation(() => {
          throw new Error("Test Error");
        }),
        str: vi.fn().mockReturnValue("Hello, World!"),
      };
      // Act
      const result = getItemContent(item);
      // Assert
      expect(result).toBeString();
      expect(item.listWords).toHaveBeenCalled();
      expect(item.str).toHaveBeenCalled();
      expect(result).toBe("Hello, World!");
    });
    it("Will try to toString if item.str is not a function", () => {
      // Arrange
      const item = {
        blockType: TYPE.LINE,
        str: "Not a string XD",
        listWords: vi.fn(() => {
          throw new Error("Test Error");
        }),
        toString: vi.fn().mockReturnValue("Hello, World!"),
      };
      // Act
      const result = getItemContent(item);
      // Assert
      expect(result).toBeString();
      expect(item.toString).toHaveBeenCalled();
      expect(result).toBe("Hello, World!");
    });
    it("Will cast String if item.str is not a function", () => {
      // Arrange
      const item = {
        blockType: TYPE.LINE,
        str: "Not a string XD",
        listWords: vi.fn(() => {
          throw new Error("Test Error");
        }),
      };
      // Act
      const result = getItemContent(item);
      // Assert
      expect(result).toBeString();
      expect(result).toBe("[object Object]");
    });
    describe("Get Abstract", () => {
      it("Calls listWords when listContent isn't available", () => {
        //
        const fieldKey = page.getItemByBlockId(
          "032554c1-78fd-4d8a-9487-3b273c63f311",
        );
        expect(TYPE.KEY_VALUE_SET).toBeString();
        expect(fieldKey.blockType).toBe(TYPE.KEY_VALUE_SET);
        // Arrange
        const returnedIds = [];
        // Act
        getItemContent(fieldKey, { returnedIds });
        // Assert
        expect(returnedIds).toBeArray();
        expect(returnedIds.length).toBeGreaterThan(0);
      });
    });
  });
  describe("Features", () => {
    describe("Item by block type", () => {
      it("Calls item str if there is no block type", () => {
        const item = {
          str: vi.fn().mockReturnValue("Hello, World!"),
        };
        getItemContent(item);
        expect(item.str).toHaveBeenCalled();
      });
      it("Calls item str in desperation", () => {
        const item = {
          blockType: "UNKNOWN",
          str: vi.fn().mockReturnValue("Hello, World!"),
        };
        getItemContent(item);
        expect(item.str).toHaveBeenCalled();
      });
      it("Prints KEY_VALUE_SET content", () => {
        // Arrange
        const item = page.getItemByBlockId(
          "6b290323-0109-4313-bf4d-4d8ab2efbf7e",
        );
        expect(TYPE.KEY_VALUE_SET).toBeString();
        expect(item.blockType).toBe(TYPE.KEY_VALUE_SET);
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        expect(result).toMatch(/^\w+ \w.*$/); // At least two words
      });
      it("Prints LAYOUT_HEADER content with `##`", () => {
        // Assure
        const item = page.layout.listItems()[0]; // LayoutHeaderGeneric
        expect(item.blockType).toBe(TYPE.LAYOUT_HEADER);
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        expect(result).toMatch(/^##/);
        expect(result).toMatch(/^##.+\n##.+$/);
        // Split on newline
        const lines = result.split("\n");
        expect(lines.length).toBe(2);
        expect(lines[0]).toBe("## STATE OF OHIO");
        expect(lines[1]).toBe("## COUNTY OF FRANKLIN");
      });
      it("Prints LAYOUT_TEXT content as is", () => {
        // Assure
        const item = page.layout.listItems()[12]; // LayoutTextGeneric
        expect(item.blockType).toBe(TYPE.LAYOUT_TEXT);
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        expect(result).toBe(result.trim());
      });
      it("Calls out handwriting in LAYOUT_TEXT", () => {
        // Assure
        const item = page.layout.listItems()[4]; // LayoutTextGeneric
        expect(item.blockType).toBe(TYPE.LAYOUT_TEXT);
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        expect(result).toMatch(/--{"handwriting":".+?"}--/);
      });
      it("Prints LAYOUT_KEY_VALUE", () => {
        // Assure
        const item = page.layout.listItems()[5]; // LayoutKeyValueGeneric
        expect(item.blockType).toBe(TYPE.LAYOUT_KEY_VALUE);
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        // Split on newline
        const lines = result.split("\n");
        expect(lines.length).toBe(5);
        expect(lines[0]).toMatch(/--{"handwriting":".+?"}--/);
        expect(lines[1]).toBe(
          "IN TESTIMONY WHEREOF, I have hereunto set my hand and affix my official seal at",
        );
        expect(lines[3]).toMatch(/--{"handwriting":".+?"}--/);
      });
      it("Prints LAYOUT_FIGURE", () => {
        // Assure
        const item = page.layout.listItems()[10]; // LayoutFigureGeneric
        expect(item.blockType).toBe(TYPE.LAYOUT_FIGURE);
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        expect(result).toMatch(/^!\[Figure: .+?\]\(figure-.+?\.jpg\)/);
      });
      it("Prints LAYOUT_PAGE_NUMBER", () => {
        // Assure
        const item = page.layout.listItems()[17]; // LayoutPageNumberGeneric
        expect(item.blockType).toBe(TYPE.LAYOUT_PAGE_NUMBER);
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        expect(result).toMatch(/--{"pageNumber":.+?}--/);
      });
      it("Prints LAYOUT_TITLE content with `#`", () => {
        // Assure
        const item = {
          blockType: TYPE.LAYOUT_TITLE,
          listContent: vi.fn().mockReturnValue([
            // * This bypasses if (item.blockType) in getItemContent
            { str: () => "LEASE AGREEMENT" },
            { str: () => "THIS LEASE AGREEMENT" },
          ]),
        };
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        expect(result).toMatch(/^#/);
        expect(result).toMatch(/^#.+\n#.+/);
        // Split on newline
        const lines = result.split("\n");
        expect(lines.length).toBe(2);
        expect(lines[0]).toBe("# LEASE AGREEMENT");
        expect(lines[1]).toBe("# THIS LEASE AGREEMENT");
      });
      it("Prints TABLE content", async () => {
        // Arrange
        const fileBuffer = await readFile(MOCK.COMPLETE_DOCUMENT);
        const document = new TextractDocument(JSON.parse(fileBuffer));
        const tablePage = document.pageNumber(2);
        // Assure
        const item = tablePage.listTables()[0];
        expect(item.blockType).toBe(TYPE.TABLE);
        // Act
        const result = getItemContent(item);
        // console.log(result);
        // Assert
        expect(result).toBeString();
        const lines = result.split("\n");
        expect(lines.length).toBeGreaterThan(0);
        // All lines have four pipes (in this table)
        lines.forEach((line) => {
          if (line.includes("|")) {
            expect(line.match(/\|/g).length).toBe(4);
          }
        });
      });
      it("Returns plain strings", () => {
        // Arrange
        const item = "Hello, World!";
        // Act
        const result = getItemContent(item);
        // Assert
        expect(result).toBeString();
        expect(result).toBe(item);
      });
    });
    describe("Options parameter", () => {
      describe("Returned Ids Array (side effect)", () => {
        it("Returns LAYOUT_FIGURE ids", () => {
          // Assure
          const item = page.layout.listItems()[10]; // LayoutFigureGeneric
          expect(item.blockType).toBe(TYPE.LAYOUT_FIGURE);
          // Arrange
          const returnedIds = [];
          // Act
          getItemContent(item, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBe(12); // We know there are 12 ids in this figure
        });
        it("Returns LAYOUT_HEADER ids", () => {
          // Assure
          const item = page.layout.listItems()[0]; // LayoutHeaderGeneric
          expect(item.blockType).toBe(TYPE.LAYOUT_HEADER);
          // Arrange
          const returnedIds = [];
          // Act
          getItemContent(item, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBeGreaterThan(2);
        });
        it("Returns LINE ids", () => {
          // Assure
          const item = page.listLines()[0]; // LineGeneric
          expect(item.blockType).toBe(TYPE.LINE);
          // Arrange
          const returnedIds = [];
          // Act
          getItemContent(item, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBeGreaterThan(0);
        });
        it("Returns LAYOUT_KEY_VALUE ids", () => {
          // Assure
          const item = page.layout.listItems()[5]; // LayoutKeyValueGeneric
          expect(item.blockType).toBe(TYPE.LAYOUT_KEY_VALUE);
          // Arrange
          const returnedIds = [];
          // Act
          getItemContent(item, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBeGreaterThan(0);
        });
        it("Returns LAYOUT_PAGE_NUMBER ids", () => {
          // Assure
          const item = page.layout.listItems()[17]; // LayoutPageNumberGeneric
          expect(item.blockType).toBe(TYPE.LAYOUT_PAGE_NUMBER);
          // Arrange
          const returnedIds = [];
          // Act
          getItemContent(item, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBeGreaterThan(0);
          expect(returnedIds.length).toBe(2);
        });
        it("Returns LAYOUT_TEXT ids", () => {
          // Assure
          const item = page.layout.listItems()[12]; // LayoutTextGeneric
          expect(item.blockType).toBe(TYPE.LAYOUT_TEXT);
          // Arrange
          const returnedIds = [];
          // Act
          getItemContent(item, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBeGreaterThan(0);
        });
        it("Returns SIGNATURE ids (but there are none)", () => {
          // Assure
          const signature = page.listSignatures()[0];
          expect(signature.id).toBeString();
          // Arrange
          const returnedIds = [];
          // Act
          getItemContent(signature, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBe(0);
        });
        it("Returns KEY_VALUE_SET ids", () => {
          // Assure
          const keyValueSet = page.getItemByBlockId(
            "6b290323-0109-4313-bf4d-4d8ab2efbf7e",
          );
          expect(TYPE.KEY_VALUE_SET).toBeString();
          expect(keyValueSet.blockType).toBe(TYPE.KEY_VALUE_SET);
          // Arrange
          const returnedIds = [];
          // Act
          getItemContent(keyValueSet, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBeGreaterThan(0);
        });
        it("Returns relationships ids by default", () => {
          // Arrange
          const item = {
            blockType: "UNKNOWN",
            listContent: vi
              .fn()
              .mockReturnValue([{ id: "1" }, { id: "2" }, { id: "3" }]),
          };
          const returnedIds = [];
          // Act
          getItemContent(item, { returnedIds });
          // Assert
          expect(returnedIds).toBeArray();
          expect(returnedIds.length).toBe(3);
        });
      });
    });
  });
});
