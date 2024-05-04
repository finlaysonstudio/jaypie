// see types of prompts:
// https://github.com/enquirer/enquirer/tree/master/examples
//
module.exports = [
  {
    type: "input",
    name: "nameInput",
    message: "Handler name; singular (e.g., 'itemAction'):",
    onSubmit: (name, value, input) => {
      input.state.answers.name = value;
    },
  },
  {
    type: "input",
    name: "pathInput",
    message: "Path (e.g., 'express/routes/item'):",
    onSubmit: (name, value, input) => {
      input.state.answers.path = value;
    },
  },
  {
    type: "input",
    name: "subtypeInput",
    initial: "handler",
    message: "Subtype (always 'handler'):",
    onSubmit: (name, value, input) => {
      input.state.answers.subtype = value;
      input.state.answers.dotSubtype = value ? `.${value}` : "";
    },
  },
  {
    type: "input",
    name: "subspecInput",
    initial: "express",
    message: "Sub-spec test command (always 'express'):",
    onSubmit: (name, value, input) => {
      input.state.answers.subspec = value;
      input.state.answers.colonSubspec = value ? `:${value}` : "";
    },
  },
];
