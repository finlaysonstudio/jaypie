import { random } from "./random.js";
import { roll } from "./roll.js";
import { time } from "./time.js";
import { weather } from "./weather.js";

export const toolkit = {
  random,
  roll,
  time,
  weather,
};

export const tools = Object.values(toolkit);
