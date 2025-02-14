declare function placeholders(
  template: string | (() => string),
  data?: Record<string, unknown>,
): string;

export default placeholders;
