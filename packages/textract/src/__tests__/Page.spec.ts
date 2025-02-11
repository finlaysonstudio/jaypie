import { TextractDocument } from "amazon-textract-response-parser";
import { log } from "jaypie";
import { readFile } from "fs/promises";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Subject
import Page from "../Page.js";
import { TextractPage } from "../types.js";

//
//
// Mock constants
//

const MOCK = {
  COMPLETE_DOCUMENT:
    "./packages/textract/src/__tests__/__fixtures__/textract.json",
  SIGNATURE_PAGE:
    "./packages/textract/src/__tests__/__fixtures__/signature.json",
};

//
//
// Run tests
//

describe("Page Class", () => {
  it("Works", async () => {
    expect(Page).not.toBeUndefined();
    expect(Page).toBeClass();
  });
  describe("Complete Document", () => {
    it("Converts to markdown", async () => {
      const fileBuffer = await readFile(MOCK.COMPLETE_DOCUMENT);
      const document = new TextractDocument(JSON.parse(fileBuffer.toString()));
      const pages = document
        .listPages()
        .map((page) => new Page(page as unknown as TextractPage));

      const markdown = pages.map((page) => page.text).join("\n\n");

      expect(markdown).toBeString();
      expect(markdown).toInclude("---");
      expect(markdown.split("\n\n").length).toBeGreaterThan(1);
    });
  });
  describe("Instantiation", () => {
    let page: Page;
    beforeAll(async () => {
      const fileBuffer = await readFile(MOCK.SIGNATURE_PAGE);
      const document = new TextractDocument(JSON.parse(fileBuffer.toString()));
      page = new Page(document.pageNumber(1) as unknown as TextractPage);
    });
    it("Instantiates from amazon-textract-response-parser page", async () => {
      expect(page).toBeInstanceOf(Page);
    });
    describe("Get", () => {
      describe("Text", () => {
        it("Has get text (with expected blocks)", () => {
          const text = page.text;
          expect(text).toBeString();
          expect(text.split("\n").length).toBe(69);
          expect(text.split("\n\n").length).toBe(19);
        });
        it("Has get _text (right now)", () => {
          expect(page._text).toBeString();
        });
        describe("Our custom text format", () => {
          let blocks: string[];
          let text: string;
          beforeAll(async () => {
            text = page.text;
            blocks = text.split("\n\n");
          });
          afterEach(() => {
            vi.clearAllMocks();
          });
          it("Get text uses our custom format", () => {
            expect(text).toBeString();
            // console.log(text);
          });
          it("Doesn't warn when processing text (because of missing entries)", () => {
            // We check var because warn doesn't pick it up during log.warn.var
            expect(log.var).not.toHaveBeenCalled();
            text = page.text;
            expect(log.var).not.toHaveBeenCalled();
          });
          it("Can be broken into double newline blocks", () => {
            expect(blocks).toBeArray();
            expect(blocks.length).toBeGreaterThan(1);
          });
          it("First block is front matter", () => {
            const frontMatter = blocks[0];
            expect(frontMatter).toBeString();
            expect(frontMatter).toMatch(/^---\n/);
            expect(frontMatter).toMatch(/\n---$/);
          });
          it("Includes signature blocks", () => {
            const frontMatter = blocks[0];
            expect(frontMatter).toMatch(/signatures: 2/);
          });
          describe("How It Works", () => {
            // "How It Works" are fragile and need not be maintained beyond their understood use
            it("Creates an _index object on init", () => {
              // Access private property for testing
              const index = (page as any)._index;
              expect(index).toBeObject();
              expect(index).not.toBeEmpty();
              expect(index.element).toBeObject();
              expect(index.element).not.toBeEmpty();
              expect(index.id).toBeObject();
              expect(index.id).not.toBeEmpty();
            });
            it("Creates a tableFirstWord object on init", () => {
              // Access private property for testing
              const index = (page as any)._index;
              expect(index.tableFirstWord).toBeObject();
              // Empty because page one has no tables
              expect(index.tableFirstWord).toBeEmpty();
            });
          });
        });
      });
      describe("Layout Text", () => {
        it("Has _layout (right now)", () => {
          // Access private property for testing
          const layout = (page as any)._layout;
          expect(layout).toBeObject();
          expect(layout.constructor.name).toBe("LayoutGeneric");
          expect(layout.str()).toBeString();
        });
      });
    });
  });
  describe("Tables", () => {
    describe("How It Works", () => {
      // "How It Works" are fragile and need not be maintained beyond their understood use
      it("Creates tableFirstWord in _index init", async () => {
        const fileBuffer = await readFile(MOCK.COMPLETE_DOCUMENT);
        const document = new TextractDocument(
          JSON.parse(fileBuffer.toString()),
        );
        const page = new Page(
          document.pageNumber(2) as unknown as TextractPage,
        );
        // Access private property for testing
        const index = (page as any)._index;
        expect(index.tableFirstWord).toBeObject();
        expect(index.tableFirstWord).not.toBeEmpty();
      });
      it("Markdown includes tables", async () => {
        const fileBuffer = await readFile(MOCK.COMPLETE_DOCUMENT);
        const document = new TextractDocument(
          JSON.parse(fileBuffer.toString()),
        );
        const page = new Page(
          document.pageNumber(2) as unknown as TextractPage,
        );
        const text = page.text;
        // It is a table
        expect(text).toContain("|");
        // It has the title, but doesn't duplicate the cell headings
        expect(text).toContain("# INDEX TO LEASE");
        expect(text).toContain("INVALIDITY OF PARTICULAR PROVISIONS");
        expect(text).not.toContain("# INDEX TO LEASE SECTION PAGE");
        // It has the footer but doesn't squash it together
        expect(text).toContain("EXHIBIT A - SKETCH OF PREMISES");
        expect(text).toContain("EXHIBIT B - RULES AND REGULATIONS");
        expect(text).not.toContain(
          "EXHIBIT A - SKETCH OF PREMISES EXHIBIT B - RULES AND REGULATIONS",
        );
        expect(log).not.toBeCalledAboveTrace();
      });
    });
  });
});
