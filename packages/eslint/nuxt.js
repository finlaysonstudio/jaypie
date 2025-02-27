import rules from "./index.js";

// Create a copy of the rules array without the Nuxt ignore and TypeScript blocks
const nuxtRules = rules.filter((rule) => {
  // Skip the Nuxt ignore block and TypeScript block by their names
  return (
    rule.name !== "jaypie:ignore-nuxt" && rule.name !== "jaypie:typescript"
  );
});

export default nuxtRules;
