// see types of prompts:
// https://github.com/enquirer/enquirer/tree/master/examples
//
module.exports = [
  {
    type: "input",
    name: "accessInput",
    initial: "public",
    message: "Access ('public' or 'restricted'):",
    onSubmit: (name, value, input) => {
      input.state.answers.access = value;
    },
  },
  {
    type: "input",
    name: "pathInput",
    initial: ".github/workflows",
    message: "Path (always '.github/workflows'):",
    onSubmit: (name, value, input) => {
      input.state.answers.path = value;
    },
  },
  {
    type: "input",
    name: "nameInput",
    initial: "npm-deploy",
    message: "File name, no extension (always 'npm-deploy'):",
    onSubmit: (name, value, input) => {
      input.state.answers.name = value;
    },
  },
];
