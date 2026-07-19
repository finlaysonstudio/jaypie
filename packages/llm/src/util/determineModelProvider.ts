import { DEFAULT, PROVIDER } from "../constants";

export function determineModelProvider(input?: string): {
  model: string;
  provider?: string;
} {
  if (!input) {
    return {
      model: DEFAULT.PROVIDER.DEFAULT,
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

  // Check for explicit fireworks: prefix
  if (input.startsWith("fireworks:")) {
    const model = input.slice("fireworks:".length);
    return {
      model,
      provider: PROVIDER.FIREWORKS.NAME,
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
      model: PROVIDER.BEDROCK.DEFAULT,
      provider: PROVIDER.BEDROCK.NAME,
    };
  }
  if (input === PROVIDER.FIREWORKS.NAME) {
    return {
      model: PROVIDER.FIREWORKS.DEFAULT,
      provider: PROVIDER.FIREWORKS.NAME,
    };
  }
  if (input === PROVIDER.ANTHROPIC.NAME) {
    return {
      model: PROVIDER.ANTHROPIC.DEFAULT,
      provider: PROVIDER.ANTHROPIC.NAME,
    };
  }
  if (input === PROVIDER.GOOGLE.NAME || input === "gemini") {
    return {
      model: PROVIDER.GOOGLE.DEFAULT,
      provider: PROVIDER.GOOGLE.NAME,
    };
  }
  if (input === PROVIDER.OPENAI.NAME) {
    return {
      model: PROVIDER.OPENAI.DEFAULT,
      provider: PROVIDER.OPENAI.NAME,
    };
  }
  if (input === PROVIDER.OPENROUTER.NAME) {
    return {
      model: PROVIDER.OPENROUTER.DEFAULT,
      provider: PROVIDER.OPENROUTER.NAME,
    };
  }
  if (input === PROVIDER.XAI.NAME) {
    return {
      model: PROVIDER.XAI.DEFAULT,
      provider: PROVIDER.XAI.NAME,
    };
  }

  // Exact model ids are classified by the "/" rule and MODEL_MATCH_WORDS below,
  // so no per-provider id catalog is consulted here.

  // Check Fireworks match words before the "/" rule — Fireworks ids contain
  // "/" (e.g., "accounts/fireworks/models/glm-5p2") and would otherwise route
  // to OpenRouter
  const lowerInputEarly = input.toLowerCase();
  for (const matchWord of PROVIDER.FIREWORKS.MODEL_MATCH_WORDS) {
    if (lowerInputEarly.includes(matchWord)) {
      return {
        model: input,
        provider: PROVIDER.FIREWORKS.NAME,
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
