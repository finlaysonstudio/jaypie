import type { Migration } from "../runner.js";

import seedOwnerApikey from "./001-seed-owner-apikey.js";

const migrations: Migration[] = [seedOwnerApikey];

export { migrations };
