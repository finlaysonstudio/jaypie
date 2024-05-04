---
to: <%= path %>/<%= name %><%= dotSubtype %>.js
---
import { readFile, writeFile } from "fs/promises";
import { force, log, validate } from "jaypie";

//
//
// Constants
//

//
//
// Helper Functions
//

//
//
// Main
//

const <%= name %> = async ({ dryRun = false, file, outputFile } = {}) => {
  // Validate
  dryRun = force.boolean(dryRun);
  validate.string(file);
  validate.string(outputFile, { required: false });

  // Setup
  if (dryRun) {
    log.debug("<%= hyphenCase %> --dry-run");
  }

  // const fileBuffer = await readFile(file);
  // const document = JSON.parse(fileBuffer);

  // ...

  // Results
  if (!dryRun && outputFile) {
    // await writeFile(outputFile, JSON.stringify(results, null, 2));
  } else {
    // eslint-disable-next-line no-console
    // console.log(JSON.stringify(results, null, 2));
  }
  // return results;
};

//
//
// Export
//

export default <%= name %>;
