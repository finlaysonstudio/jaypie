// see types of prompts:
// https://github.com/enquirer/enquirer/tree/master/examples
//
module.exports = [
  {
    type: "input",
    name: "path",
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
    name: "name",
    message: "File name (e.g., 'sum' not 'sum.function'):",
  },
  {
    type: "input",
    name: "subtype",
    message: "Subtype (optional; e.g., 'function'):",
    onSubmit: (name, value, input) => {
      input.state.answers.dotSubtype = value ? `.${value}` : "";
    },
  },
  {
    type: "input",
    name: "subspec",
    message:
      "Sub-spec test, for `npm run test:spec:SUBSPEC:sum.function` command (e.g., 'express'):",
    onSubmit: (name, value, input) => {
      input.state.answers.colonSubspec = value ? `:${value}` : "";
    },
  },
];
