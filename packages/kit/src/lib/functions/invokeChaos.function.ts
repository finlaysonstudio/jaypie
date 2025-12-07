import { jaypieErrorFromStatus } from "@jaypie/errors";
import sleep from "./sleep.function.js";

//
//
// Constants
//

const CHAOS_RATE_HIGH = 0.382;
const CHAOS_RATE_MEDIUM = 0.146;
const CHAOS_RATE_LOW = 0.021;

const CHAOS_SLEEP_MINIMUM = 0;
const CHAOS_SLEEP_MAXIMUM = 12000;
const CHAOS_TIMEOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

//
//
// Types
//

interface InvokeChaosOptions {
  log?: {
    trace?: (message: string) => void;
  };
}

//
//
// Main
//

const invokeChaos = async (
  message = "medium",
  { log }: InvokeChaosOptions = {},
): Promise<void> => {
  // Handle error case
  if (message === "error") {
    if (log && typeof log.trace === "function") {
      log.trace(`Chaos error triggered, throwing 500 error`);
    }
    throw jaypieErrorFromStatus(500);
  }

  // Handle error=<statusCode> pattern
  const errorMatch = message?.match(/^error=(\d+)$/);
  if (errorMatch) {
    const statusCode = parseInt(errorMatch[1], 10);
    if (log && typeof log.trace === "function") {
      log.trace(`Chaos error triggered, throwing ${statusCode} error`);
    }
    throw jaypieErrorFromStatus(statusCode);
  }

  // Handle timeout case - 15 minute sleep then 500 error
  if (message === "timeout") {
    if (log && typeof log.trace === "function") {
      log.trace(`Chaos timeout triggered, sleeping for 15 minutes`);
    }
    await sleep(CHAOS_TIMEOUT_DURATION);
    throw jaypieErrorFromStatus(500);
  }

  // Handle exit case - terminate process
  if (message === "exit") {
    if (log && typeof log.trace === "function") {
      log.trace(`Chaos exit triggered, terminating process`);
    }
    process.exit(1);
  }

  // Handle memory case - exhaust system memory
  if (message === "memory") {
    if (log && typeof log.trace === "function") {
      log.trace(`Chaos memory triggered, exhausting memory`);
    }
    const arrays: number[][] = [];

    while (true) {
      // Allocate 100MB chunks until memory is exhausted
      arrays.push(new Array((100 * 1024 * 1024) / 8).fill(0));
    }
  }

  // Handle off cases
  if (
    message === "0" ||
    message === "false" ||
    message === "none" ||
    message === "off" ||
    message === "skip" ||
    message === ""
  ) {
    return;
  }

  // Determine chaos rate based on message
  let chaosRate: number;
  let logMessage = message;
  if (message === "always") {
    chaosRate = 1;
  } else if (message === "high") {
    chaosRate = CHAOS_RATE_HIGH;
  } else if (message === "low") {
    chaosRate = CHAOS_RATE_LOW;
  } else {
    // Default to medium for all other values
    chaosRate = CHAOS_RATE_MEDIUM;
    logMessage = "medium";
  }

  // Generate random value
  const randomValue = Math.random();

  // Determine outcome and sleep if needed
  if (randomValue < chaosRate) {
    const sleepDuration =
      Math.random() * (CHAOS_SLEEP_MAXIMUM - CHAOS_SLEEP_MINIMUM) +
      CHAOS_SLEEP_MINIMUM;

    // Log chaos rate with outcome if log.trace is available
    if (log && typeof log.trace === "function") {
      log.trace(
        `Chaos rate ${logMessage} (${chaosRate}) with value ${randomValue.toFixed(3)}; sleeping ${(sleepDuration / 1000).toFixed(1)}s`,
      );
    }

    await sleep(sleepDuration);
  } else {
    // Log chaos rate with outcome if log.trace is available
    if (log && typeof log.trace === "function") {
      log.trace(
        `Chaos rate ${logMessage} (${chaosRate}) with value ${randomValue.toFixed(3)}; skipping`,
      );
    }
  }
};

export default invokeChaos;
