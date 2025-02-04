import { matchers as jaypieMatchers } from "@jaypie/testkit";
import * as extendedMatchers from "jest-extended";
import { expect, vi } from "vitest";

expect.extend(extendedMatchers);
expect.extend(jaypieMatchers);

vi.mock("@jaypie/aws", async () => ({
  ...(await vi.importActual("@jaypie/testkit/mock")),
}));
