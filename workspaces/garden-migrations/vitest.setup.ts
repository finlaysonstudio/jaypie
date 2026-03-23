import { vi } from "vitest";

vi.mock("jaypie", async () => {
  const testkit = await import("@jaypie/testkit/mock");
  return testkit;
});
