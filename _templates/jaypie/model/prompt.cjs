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
    name: "nameInput",
    message: "Model name, singular (e.g., 'user'):",
    onSubmit: (name, value, input) => {
      input.state.answers.name = value;
    },
  },
  {
    type: "input",
    name: "pathInput",
    initial: "src",
    message: "Workspace Path (e.g., 'src/models'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.\//, "").replace(/\/$/, "");
      if (value === "") value = ".";
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
    name: "subtypeInput",
    initial: "schema",
    message: "Subtype (always 'schema'):",
    onSubmit: (name, value, input) => {
      input.state.answers.subtype = value;
      input.state.answers.dotSubtype = value ? `.${value}` : "";
    },
  },
  {
    type: "input",
    name: "subspecInput",
    initial: "models",
    message: "Sub-spec test command (e.g., 'models'):",
    onSubmit: (name, value, input) => {
      input.state.answers.subspec = value;
      input.state.answers.colonSubspec = value ? `:${value}` : "";
    },
  },
];
