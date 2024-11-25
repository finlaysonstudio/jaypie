// see types of prompts:
// https://github.com/enquirer/enquirer/tree/master/examples
//
module.exports = [
  {
    type: "input",
    name: "workspaceInput",
    initial: "packages/models",
    message: "Workspace Path (e.g., '.'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.\//, "").replace(/\/$/, "");
      if (value === "") value = ".";
      input.state.answers.workspace = value;
    },
  },
  {
    type: "input",
    name: "pathInput",
    initial: "src",
    message: "Path (e.g., 'src/util'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.\//, "").replace(/\/$/, "");
      input.state.answers.path = value;
    },
  },
  {
    type: "input",
    name: "nameInput",
    message: "File name (e.g., 'sum'):",
    onSubmit: (name, value, input) => {
      input.state.answers.name = value;
    },
  },
  {
    type: "input",
    name: "subtypeInput",
    message: "Subtype (optional; e.g., 'function'):",
    onSubmit: (name, value, input) => {
      input.state.answers.subtype = value;
      input.state.answers.dotSubtype = value ? `.${value}` : "";
    },
  },
  {
    type: "input",
    name: "subspecInput",
    message:
      "Sub-spec test, for `npm run test:spec:SUBSPEC:sum.function` command (e.g., 'express' or 'lib:project'):",
    onSubmit: (name, value, input) => {
      input.state.answers.subspec = value;
      input.state.answers.colonSubspec = value ? `:${value}` : "";
    },
  },
];
