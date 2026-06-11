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

  // Check for explicit openrouter: prefix
  if (input.startsWith("openrouter:")) {
    const model = input.slice("openrouter:".length);
    return {
      model,
      provider: PROVIDER.OPENROUTER.NAME,
    };
  }

  // Check for explicit bedrock: prefix
  if (input.startsWith("bedrock:")) {
    const model = input.slice("bedrock:".length);
    return {
      model,
      provider: PROVIDER.BEDROCK.NAME,
    };
  }

  // Check if input is a provider name
  if (input === PROVIDER.BEDROCK.NAME) {
    return {
      model: PROVIDER.BEDROCK.MODEL.DEFAULT,
      provider: PROVIDER.BEDROCK.NAME,
    };
  }
  if (input === PROVIDER.ANTHROPIC.NAME) {
    return {
      model: PROVIDER.ANTHROPIC.MODEL.DEFAULT,
      provider: PROVIDER.ANTHROPIC.NAME,
    };
  }
  if (input === PROVIDER.GOOGLE.NAME || input === "gemini") {
    return {
      model: PROVIDER.GOOGLE.MODEL.DEFAULT,
      provider: PROVIDER.GOOGLE.NAME,
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
  if (input === PROVIDER.XAI.NAME) {
    return {
      model: PROVIDER.XAI.MODEL.DEFAULT,
      provider: PROVIDER.XAI.NAME,
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
  for (const [, modelValue] of Object.entries(PROVIDER.GOOGLE.MODEL)) {
    if (input === modelValue) {
      return {
        model: input,
        provider: PROVIDER.GOOGLE.NAME,
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

  // Check if input matches an xAI model exactly
  for (const [, modelValue] of Object.entries(PROVIDER.XAI.MODEL)) {
    if (input === modelValue) {
      return {
        model: input,
        provider: PROVIDER.XAI.NAME,
      };
    }
  }

  // Assume OpenRouter for models containing "/" (e.g., "openai/gpt-4", "anthropic/claude-3-opus")
  // This check must come before match words so that "openai/gpt-4" is not matched by "openai" keyword
  if (input.includes("/")) {
    return {
      model: input,
      provider: PROVIDER.OPENROUTER.NAME,
    };
  }

  // Check Bedrock match words (before Anthropic — "anthropic.claude-*" is a Bedrock model ID)
  const lowerInput = input.toLowerCase();
  for (const matchWord of PROVIDER.BEDROCK.MODEL_MATCH_WORDS) {
    if (lowerInput.includes(matchWord)) {
      return {
        model: input,
        provider: PROVIDER.BEDROCK.NAME,
      };
    }
  }

  // Check Anthropic match words
  for (const matchWord of PROVIDER.ANTHROPIC.MODEL_MATCH_WORDS) {
    if (lowerInput.includes(matchWord)) {
      return {
        model: input,
        provider: PROVIDER.ANTHROPIC.NAME,
      };
    }
  }

  // Check Gemini match words
  for (const matchWord of PROVIDER.GOOGLE.MODEL_MATCH_WORDS) {
    if (lowerInput.includes(matchWord)) {
      return {
        model: input,
        provider: PROVIDER.GOOGLE.NAME,
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

  // Check xAI match words
  for (const matchWord of PROVIDER.XAI.MODEL_MATCH_WORDS) {
    if (lowerInput.includes(matchWord)) {
      return {
        model: input,
        provider: PROVIDER.XAI.NAME,
      };
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
