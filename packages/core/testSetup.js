import { expect } from "vitest";
import * as matchers from "jest-extended";
import { matchers as jaypieMatchers } from "@jaypie/testkit";
import { matchers as jsonSchemaMatchers } from "jest-json-schema";

expect.extend(matchers);
expect.extend(jsonSchemaMatchers);
expect.extend(jaypieMatchers);
