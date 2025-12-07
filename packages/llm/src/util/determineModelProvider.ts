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
  if (input === PROVIDER.GEMINI.NAME) {
    return {
      model: PROVIDER.GEMINI.MODEL.DEFAULT,
      provider: PROVIDER.GEMINI.NAME,
    };
  }
  if (input === PROVIDER.OPENAI.NAME) {
    return {
      model: PROVIDER.OPENAI.MODEL.DEFAULT,
      provider: PROVIDER.OPENAI.NAME,
    };
  }
  if (input === PROVIDER.OPENROUTER.NAME) {
    return {
      model: PROVIDER.OPENROUTER.MODEL.DEFAULT,
      provider: PROVIDER.OPENROUTER.NAME,
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

  // Check if input matches a Gemini model exactly
  for (const [, modelValue] of Object.entries(PROVIDER.GEMINI.MODEL)) {
    if (input === modelValue) {
      return {
        model: input,
        provider: PROVIDER.GEMINI.NAME,
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

  // Check if input matches an OpenRouter model exactly
  for (const [, modelValue] of Object.entries(PROVIDER.OPENROUTER.MODEL)) {
    if (input === modelValue) {
      return {
        model: input,
        provider: PROVIDER.OPENROUTER.NAME,
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

  // Check Gemini match words
  for (const matchWord of PROVIDER.GEMINI.MODEL_MATCH_WORDS) {
    if (lowerInput.includes(matchWord)) {
      return {
        model: input,
        provider: PROVIDER.GEMINI.NAME,
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

  // Check OpenRouter match words
  for (const matchWord of PROVIDER.OPENROUTER.MODEL_MATCH_WORDS) {
    if (lowerInput.includes(matchWord)) {
      return {
        model: input,
        provider: PROVIDER.OPENROUTER.NAME,
      };
    }
  }

  // Default fallback if model not recognized
  return {
    model: input,
  };
}
