import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect, vi } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);

vi.mock("jaypie", async () => {
  return {
    ...(await vi.importActual("@jaypie/testkit/mock")),
    log: {
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      init: vi.fn(),
      lib: vi.fn(),
      tag: vi.fn(),
      trace: vi.fn(),
      untag: vi.fn(),
      var: vi.fn(),
      warn: vi.fn(),
      with: vi.fn(),
    },
  };
});
