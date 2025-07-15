import { Toolkit } from "./Toolkit.class.js";

import { random } from "./random.js";
import { roll } from "./roll.js";
import { time } from "./time.js";
import { weather } from "./weather.js";

export const tools = [random, roll, time, weather];

export const toolkit = new Toolkit(tools);

export { Toolkit };
