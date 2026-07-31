// Stands in for the `vitest.setup.ts` that skill("subpackage") prescribes.
//
// Importing @jaypie/testkit anywhere in the program is what pulls the `vitest`
// module augmentation in. Specs that only call the matchers, without importing
// the package themselves, rely on this file being part of the compilation.

import { matchers } from "@jaypie/testkit";
import { expect } from "vitest";

expect.extend(matchers);
