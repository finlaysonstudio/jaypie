// see types of prompts:
// https://github.com/enquirer/enquirer/tree/master/examples
//
module.exports = [
  {
    type: "input",
    name: "actionInput",
    message: "Action name (e.g., 'file'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.?\/|\/$/g, "");
      input.state.answers.action = value;
    },
  },
  {
    type: "input",
    name: "generatorInput",
    initial: "project",
    message: "Hygen generator directory (e.g., 'jaypie'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.?\/|\/$/g, "");
      input.state.answers.generator = value;
    },
  },
  {
    type: "input",
    name: "hygenInput",
    initial: "_templates",
    message: "Hygen template directory (always '_templates'):",
    onSubmit: (name, value, input) => {
      // Remove leading './' and trailing '/'
      value = value.replace(/^\.?\/|\/$/g, "");
      input.state.answers.hygen = value;
    },
  },
];
