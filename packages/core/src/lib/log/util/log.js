import { COLOR } from "./constants.js";
import stringify from "./stringify.js";

//
//
// Main
//

const log = (messages, color = COLOR.PLAIN) => {
  // eslint-disable-next-line no-console
  console.log(color(stringify(...messages)));
};

//
//
// Export
//

export default log;
