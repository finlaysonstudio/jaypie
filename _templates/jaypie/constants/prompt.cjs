// see types of prompts:
// https://github.com/enquirer/enquirer/tree/master/examples
//
module.exports = [
  {
    type: "input",
    name: "pathInput",
    initial: "src/util",
    message: "Path (e.g., 'src/lib/project'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.\//, "").replace(/\/$/, "");
      input.state.answers.path = value;
    },
  },
  {
    type: "input",
    name: "subspecInput",
    message:
      "Sub-spec test, for `npm run test:spec:SUBSPEC:constants` command (usually 'lib:project' unless the top-level constants):",
    onSubmit: (name, value, input) => {
      input.state.answers.subspec = value;
      input.state.answers.colonSubspec = value ? `:${value}` : "";
    },
  },
  {
    type: "input",
    name: "firstConstant",
    initial: "PROJECT",
    message: "Name of first constant (prefer all uppercase):",
    onSubmit: (name, value, input) => {
      input.state.answers.first = value;
    },
  },
  {
    type: "input",
    name: "nameInput",
    initial: "constants",
    message: "File name (always 'constants'):",
    onSubmit: (name, value, input) => {
      input.state.answers.name = value;
    },
  },
  {
    type: "input",
    name: "subtypeInput",
    message: "Subtype (always empty, ''):",
    onSubmit: (name, value, input) => {
      input.state.answers.subtype = value;
      input.state.answers.dotSubtype = value ? `.${value}` : "";
    },
  },
];
