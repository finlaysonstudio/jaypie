import { Toolkit } from "./Toolkit.class.js";
import type { LlmTool } from "../types/LlmTool.interface.js";

import { random } from "./random.js";
import { roll } from "./roll.js";
import { time } from "./time.js";
import { weather } from "./weather.js";

export const tools = [random, roll, time, weather];

export class JaypieToolkit extends Toolkit {
  public readonly random: LlmTool;
  public readonly roll: LlmTool;
  public readonly time: LlmTool;
  public readonly weather: LlmTool;

  constructor(tools: LlmTool[], options?: any) {
    super(tools, options);
    this.random = random;
    this.roll = roll;
    this.time = time;
    this.weather = weather;
  }
}

export const toolkit = new JaypieToolkit(tools);

export { Toolkit };
