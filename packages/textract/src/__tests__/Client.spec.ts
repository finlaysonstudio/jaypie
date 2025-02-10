import { TextractDocument } from "amazon-textract-response-parser";
import { readFile } from "fs/promises";
import { beforeAll, describe, expect, it } from "vitest";

import { TYPE } from "../constants.js";

//
//
// Mock modules
//

const MOCK = {
  COMPLETE_DOCUMENT:
    "./packages/textract/src/__tests__/__fixtures__/textract.json",
};

let completeDocument;
let tablePage;

beforeAll(async () => {
  const fileBuffer = await readFile(MOCK.COMPLETE_DOCUMENT);
  completeDocument = new TextractDocument(JSON.parse(fileBuffer));
  tablePage = completeDocument.pageNumber(2);
});

//
//
// Run tests
//

describe("Textract Library", () => {
  describe("Table of Contents Page", () => {
    describe("Layout Items", () => {
      let layoutItems;
      let titles;
      let footers;
      let content;
      beforeAll(() => {
        layoutItems = tablePage.layout.listItems();
        titles = layoutItems.filter(
          (item) => item.blockType === TYPE.LAYOUT_TITLE,
        );
        footers = layoutItems.filter(
          (item) => item.blockType === TYPE.LAYOUT_FOOTER,
        );
        content = layoutItems.filter(
          (item) => item.blockType === TYPE.LAYOUT_TEXT,
        );
      });
      it("Has 79 layout items", () => {
        expect(layoutItems.length).toBe(79);
      });
      it("Has 1 title, 1 footer, and 77 content items", () => {
        expect(titles.length).toBe(1);
        expect(footers.length).toBe(1);
        // * The content items treat the left and right columns as separate items
        expect(content.length).toBe(77);
      });
      it("Layout title is INDEX TO LEASE", () => {
        expect(titles[0].text).toBe("INDEX TO LEASE");
        expect(layoutItems[0].text).toBe("INDEX TO LEASE");
      });
      it("Sees TOC columns as different _layout_ items", () => {
        expect(layoutItems[1].text).toBe("SECTION");
        expect(layoutItems[2].text).toBe("PAGE");
        expect(content[0].text).toBe("SECTION");
        expect(content[0].listContent().length).toBe(1);
        expect(content[1].text).toBe("PAGE");
        expect(content[1].listContent().length).toBe(1);
      });
      it("Splits table rows into multiple entities", () => {
        const contentLine = content[2].listContent();
        expect(contentLine.length).toBe(2);
        expect(contentLine[0].text).toBe("1.");
        expect(contentLine[1].text).toBe("DEFINITIONS");
        expect(content[3].text).toBe("1");
        expect(content[3].listContent().length).toBe(1);
      });
      it("Has one table with a title, a footer, and 37 rows", () => {
        const table = tablePage.listTables()[0];
        expect(table).not.toBeUndefined();
        expect(table.listRows().length).toBe(37);
        expect(table.listTitles().length).toBe(1);
        expect(table.listFooters().length).toBe(1);
      });
      it("Has a single footer with four lines", () => {
        expect(footers.length).toBe(1);
        const footer = footers[0];
        expect(footer.listContent().length).toBe(4);
      });
    });
    describe("Lines", () => {
      let lines;
      beforeAll(() => {
        lines = tablePage.listLines();
      });
      it("Has 113 lines", () => {
        expect(lines.length).toBe(113);
      });
      it("First line is INDEX TO LEASE", () => {
        expect(lines[0].text).toBe("INDEX TO LEASE");
      });
      it("Second line is SECTION", () => {
        expect(lines[1].text).toBe("SECTION");
      });
      it("Third line is PAGE", () => {
        expect(lines[2].text).toBe("PAGE");
      });
      it("Fourth line is 1.", () => {
        expect(lines[3].text).toBe("1.");
      });
      it("Fifth line is DEFINITIONS", () => {
        expect(lines[4].text).toBe("DEFINITIONS");
      });
      it("Sixth line is 1", () => {
        expect(lines[5].text).toBe("1");
      });
      it("Last line is SCHEDULE I", () => {
        expect(lines[lines.length - 1].text).toBe(
          "SCHEDULE I - BASIC ANNUAL RENT SCHEDULE",
        );
      });
    });
    describe("Table", () => {
      let table;
      beforeAll(() => {
        table = tablePage.listTables()[0];
      });
      it("Has 37 rows", () => {
        expect(table.listRows().length).toBe(37);
      });
      it("Has a title and a footer", () => {
        expect(table.listTitles().length).toBe(1);
        expect(table.listFooters().length).toBe(1);
      });
      it("Has a footer but isn't broken into lines", () => {
        const footer = table.listFooters()[0];
        // We have listWords because TableFooterGeneric extends WithWords but that's it
        expect(footer.listWords).toBeFunction();
        // And, look, there is no function that returns lines
        expect(footer.listCells).toBeUndefined();
        expect(footer.listContent).toBeUndefined();
        expect(footer.listItems).toBeUndefined();
        expect(footer.listLines).toBeUndefined();
        expect(footer.listTextLines).toBeUndefined();
      });
    });
    describe("Form", () => {
      let form;
      let fields;
      beforeAll(() => {
        form = tablePage.form;
        fields = form.listFields();
      });
      it("Also represents TOC as a busted form", () => {
        expect(fields.length).toBe(38);
        // Doesn't pick up on things until the third row
        expect(fields[0].key.listWords().length).toBe(2);
        expect(fields[0].key.listWords()[0].text).toBe("3.");
        expect(fields[0].key.listWords()[1].text).toBe("TERM");
      });
    });
  });
  describe("Edge Cases", () => {
    it("FieldGeneric and FieldKeyGeneric both present as KEY_VALUE_SET", () => {
      const item = tablePage.form.listFields()[0];
      expect(item.blockType).toBe(TYPE.KEY_VALUE_SET);
      expect(item.key.blockType).toBe(TYPE.KEY_VALUE_SET);
    });
  });
});
