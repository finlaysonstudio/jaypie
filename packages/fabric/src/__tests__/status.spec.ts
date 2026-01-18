// Tests for status type

import { describe, expect, it } from "vitest";

import { isStatus, STATUS_VALUES, StatusType } from "../status.js";

describe("Status Type", () => {
  describe("STATUS_VALUES", () => {
    it("contains expected status values", () => {
      expect(STATUS_VALUES).toContain("canceled");
      expect(STATUS_VALUES).toContain("complete");
      expect(STATUS_VALUES).toContain("error");
      expect(STATUS_VALUES).toContain("pending");
      expect(STATUS_VALUES).toContain("processing");
      expect(STATUS_VALUES).toContain("queued");
      expect(STATUS_VALUES).toContain("sending");
    });

    it("has exactly 7 status values", () => {
      expect(STATUS_VALUES).toHaveLength(7);
    });

    it("is sorted alphabetically", () => {
      const sorted = [...STATUS_VALUES].sort();
      expect(STATUS_VALUES).toEqual(sorted);
    });
  });

  describe("StatusType", () => {
    it("is an array matching STATUS_VALUES", () => {
      expect(StatusType).toEqual([...STATUS_VALUES]);
    });

    it("can be used as a validated string type in fabricService", async () => {
      // Import fabricService to test integration
      const { fabricService } = await import("../service.js");

      const handler = fabricService({
        input: {
          status: { type: StatusType, description: "Current status" },
        },
        service: (input) => input,
      });

      // Valid status should pass
      const result = await handler({ status: "pending" });
      expect(result).toEqual({ status: "pending" });
    });

    it("rejects invalid status values", async () => {
      const { fabricService } = await import("../service.js");

      const handler = fabricService({
        input: {
          status: { type: StatusType },
        },
        service: (input) => input,
      });

      // Invalid status should throw
      await expect(handler({ status: "invalid" })).rejects.toThrow();
    });
  });

  describe("isStatus", () => {
    it("returns true for valid status values", () => {
      expect(isStatus("canceled")).toBe(true);
      expect(isStatus("complete")).toBe(true);
      expect(isStatus("error")).toBe(true);
      expect(isStatus("pending")).toBe(true);
      expect(isStatus("processing")).toBe(true);
      expect(isStatus("queued")).toBe(true);
      expect(isStatus("sending")).toBe(true);
    });

    it("returns false for invalid status values", () => {
      expect(isStatus("invalid")).toBe(false);
      expect(isStatus("PENDING")).toBe(false);
      expect(isStatus("")).toBe(false);
      expect(isStatus("done")).toBe(false);
    });

    it("returns false for non-string values", () => {
      expect(isStatus(null)).toBe(false);
      expect(isStatus(undefined)).toBe(false);
      expect(isStatus(123)).toBe(false);
      expect(isStatus(true)).toBe(false);
      expect(isStatus({})).toBe(false);
      expect(isStatus([])).toBe(false);
    });
  });
});
