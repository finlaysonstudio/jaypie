// see types of prompts:
// https://github.com/enquirer/enquirer/tree/master/examples
//
module.exports = [
  {
    type: "input",
    name: "nameInput",
    message: "Command name in camelCase (e.g., 'myCommand'):",
    validate: (value) => {
      if (!value) {
        return "Command name is required";
      }
      return true;
    },
    onSubmit: (name, value, input) => {
      input.state.answers.name = value;
    },
  },
  {
    type: "input",
    name: "commandHyphenCaseInput",
    message: "Command name in hyphen-case (e.g., 'my-command'):",
    validate: (value) => {
      if (!value) {
        return "Command name is required";
      }
      return true;
    },
    onSubmit: (name, value, input) => {
      input.state.answers.hyphenCase = value;
    },
  },
  {
    type: "input",
    name: "descriptionInput",
    initial: "execute the command",
    message: "Command description:",
    onSubmit: (name, value, input) => {
      input.state.answers.description = value;
    },
  },
  {
    type: "input",
    name: "commandBinPathInput",
    initial: "bin/command.js",
    message: "Command file (usually 'bin/command.js'):",
    onSubmit: (name, value, input) => {
      input.state.answers.commandPath = value;
    },
  },
  {
    type: "input",
    name: "pathInput",
    initial: "src",
    message: "Export file path (usually 'src'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.\//, "").replace(/\/$/, "");
      input.state.answers.path = value;
    },
  },
  {
    type: "input",
    name: "exportFileInput",
    initial: "index.js",
    message: "Export file name (usually 'index.js'):",
    onSubmit: (name, value, input) => {
      input.state.answers.exportFile = value;
    },
  },
  {
    type: "input",
    name: "commandBinImportPathInput",
    initial: "../src/index.js",
    message: "Command import path (usually '../src/index.js'):",
    onSubmit: (name, value, input) => {
      input.state.answers.importPath = value;
    },
  },
  {
    type: "input",
    name: "subspecInput",
    message:
      "Sub-spec test, for `npm run test:spec:SUBSPEC:sum.function` command (usually empty ''):",
    onSubmit: (name, value, input) => {
      input.state.answers.subspec = value;
      input.state.answers.colonSubspec = value ? `:${value}` : "";
    },
  },
  {
    type: "input",
    name: "subtypeInput",
    initial: "command",
    message: "Subtype (always 'command'):",
    onSubmit: (name, value, input) => {
      input.state.answers.subtype = value;
      input.state.answers.dotSubtype = value ? `.${value}` : "";
    },
  },
];
