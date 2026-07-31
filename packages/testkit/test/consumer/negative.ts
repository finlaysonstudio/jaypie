// Negative control for the consumer typecheck fixture.
//
// `toBeNotARealJaypieMatcher` does not exist. If this file typechecks, the
// fixture is not resolving @jaypie/testkit types at all and the positive
// fixture proves nothing.

import { expect } from "vitest";

expect("jaypie").toBeNotARealJaypieMatcher();
