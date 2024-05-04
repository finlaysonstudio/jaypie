---
inject: true
to: <%= commandPath %>
before: \#hygen-jaypie-command-script
skip_if: .command("<%= hyphenCase %>")
---
//
// <%= hyphenCase %>:
program
  .command("<%= hyphenCase %>")
  .description("<%= description %>")
  .requiredOption("-f, --file <file>", "input file")
  .option("-o, --outputFile <outputFile>", "output file")
  .option("-X, --dry-run", "run command without executing changes", false)
  .action(<%= name %>);