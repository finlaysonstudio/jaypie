import { describe, expect, it } from "vitest";

import { githubOidcSubjects } from "../githubOidcSubjects";

describe("githubOidcSubjects", () => {
  describe("Base Cases", () => {
    it("is a function", () => {
      expect(githubOidcSubjects).toBeFunction();
    });
  });

  describe("Happy Paths", () => {
    it("returns the plain and id-embedded organization patterns", () => {
      expect(githubOidcSubjects({ organization: "acme" })).toEqual([
        "repo:acme/*:*",
        "repo:acme@*/*:*",
      ]);
    });

    it("returns the plain and id-embedded repository patterns", () => {
      expect(
        githubOidcSubjects({ organization: "acme", repository: "widget" }),
      ).toEqual(["repo:acme/widget:*", "repo:acme@*/widget@*:*"]);
    });
  });

  describe("Features", () => {
    it("pins the organization id when supplied", () => {
      expect(
        githubOidcSubjects({
          organization: "acme",
          organizationId: "162184378",
        }),
      ).toEqual(["repo:acme/*:*", "repo:acme@162184378/*:*"]);
    });

    it("pins the repository id when supplied", () => {
      expect(
        githubOidcSubjects({
          organization: "acme",
          organizationId: "162184378",
          repository: "widget",
          repositoryId: "1339091097",
        }),
      ).toEqual([
        "repo:acme/widget:*",
        "repo:acme@162184378/widget@1339091097:*",
      ]);
    });

    it("wildcards the repository id when only the repository is known", () => {
      const [, identified] = githubOidcSubjects({
        organization: "acme",
        repository: "widget",
      });
      // A repository name cannot contain "@", so "widget@*" matches that
      // repository alone and never "widget-two".
      expect(identified).toBe("repo:acme@*/widget@*:*");
    });
  });
});
