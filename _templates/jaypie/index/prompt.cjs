// see types of prompts:
// https://github.com/enquirer/enquirer/tree/master/examples
//
module.exports = [
  {
    type: "input",
    name: "path",
    initial: "src",
    message: "Path (e.g., 'src/models'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.\//, "").replace(/\/$/, "");
      input.state.answers.path = value;
    },
  },
  {
    type: "input",
    name: "subspec",
    message: "Sub-spec test, for `npm run test:spec:SUBSPEC` (e.g., 'model'):",
    onSubmit: (name, value, input) => {
      input.state.answers.colonSubspec = value ? `:${value}` : "";
    },
  },
  {
    type: "input",
    name: "subtype",
    message: "Subtype (empty ''):",
    onSubmit: (name, value, input) => {
      input.state.answers.dotSubtype = value ? `.${value}` : "";
    },
  },
  {
    type: "input",
    name: "name",
    initial: "index",
    message: "File name (always 'index'):",
  },
];
