import rules from "./index.js";

// Create a copy of the rules array and update the CommonJS block to target .js files
const commonjsRules = rules.map((rule) => {
  if (rule.name === "jaypie:commonjs") {
    return {
      ...rule,
      files: ["**/*.js"], // Update to target .js files instead of .cjs
    };
  }
  return rule;
});

export default commonjsRules;
