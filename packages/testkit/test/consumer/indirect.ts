// A spec that uses the matchers without importing @jaypie/testkit itself.
//
// This is the shape skill("subpackage") produces, and it only typechecks when
// setup.ts is part of the same program.

import { expect } from "vitest";

class Example {}

expect(Example).toBeFunction();
expect("jaypie").toBeString();
