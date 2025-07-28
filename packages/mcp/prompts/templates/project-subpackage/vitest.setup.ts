import { matchers } from "@jaypie/testkit";
import { expect, vi } from "vitest";

expect.extend(matchers);

vi.mock("jaypie", async () => vi.importActual("@jaypie/testkit/mock"));
