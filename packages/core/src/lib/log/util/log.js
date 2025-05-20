import stringify from "./stringify.js";

//
//
// Main
//

const log = (messages) => {
  console.log(stringify(...messages));
};

//
//
// Export
//

export default log;
