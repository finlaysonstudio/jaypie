import stringify from "./stringify.js";

//
//
// Main
//

const log = (messages) => {
  // eslint-disable-next-line no-console
  console.log(stringify(...messages));
};

//
//
// Export
//

export default log;
