import { DEFAULT, PROVIDER } from "../constants";

export function determineModelProvider(input?: string): {
  model: string;
  provider?: string;
} {
  if (!input) {
    return {
      model: DEFAULT.PROVIDER.MODEL.DEFAULT,
      provider: DEFAULT.PROVIDER.NAME,
    };
  }

  // Check if input is a provider name
  if (input === PROVIDER.ANTHROPIC.NAME) {
    return {
      model: PROVIDER.ANTHROPIC.MODEL.DEFAULT,
      provider: PROVIDER.ANTHROPIC.NAME,
    };
  }
  if (input === PROVIDER.OPENAI.NAME) {
    return {
      model: PROVIDER.OPENAI.MODEL.DEFAULT,
      provider: PROVIDER.OPENAI.NAME,
    };
  }

  // Check if input matches an Anthropic model exactly
  for (const [, modelValue] of Object.entries(PROVIDER.ANTHROPIC.MODEL)) {
    if (input === modelValue) {
      return {
        model: input,
        provider: PROVIDER.ANTHROPIC.NAME,
      };
    }
  }

  // Check if input matches an OpenAI model exactly
  for (const [, modelValue] of Object.entries(PROVIDER.OPENAI.MODEL)) {
    if (input === modelValue) {
      return {
        model: input,
        provider: PROVIDER.OPENAI.NAME,
      };
    }
  }

  // Check Anthropic match words
  const lowerInput = input.toLowerCase();
  for (const matchWord of PROVIDER.ANTHROPIC.MODEL_MATCH_WORDS) {
    if (lowerInput.includes(matchWord)) {
      return {
        model: input,
        provider: PROVIDER.ANTHROPIC.NAME,
      };
    }
  }

  // Check OpenAI match words
  for (const matchWord of PROVIDER.OPENAI.MODEL_MATCH_WORDS) {
    if (typeof matchWord === "string") {
      if (lowerInput.includes(matchWord)) {
        return {
          model: input,
          provider: PROVIDER.OPENAI.NAME,
        };
      }
    } else if (matchWord instanceof RegExp) {
      if (matchWord.test(input)) {
        return {
          model: input,
          provider: PROVIDER.OPENAI.NAME,
        };
      }
    }
  }

  // Default fallback if model not recognized
  return {
    model: input,
  };
}
