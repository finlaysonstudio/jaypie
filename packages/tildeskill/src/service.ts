import { fabricService } from "@jaypie/fabric";

import { expandIncludes } from "./core/expandIncludes";
import { normalizeAlias } from "./core/normalize";
import { isValidAlias } from "./core/validate";
import type { SkillRecord, SkillStore } from "./types";

function formatSkillListItem(skill: SkillRecord): string {
  if (skill.description) {
    return `* ${skill.alias} - ${skill.description}`;
  }
  return `* ${skill.alias}`;
}

/**
 * Create a fabric service that looks up skills from a SkillStore.
 *
 * The returned service accepts `{ alias }` input:
 * - `"index"` or omitted → formatted listing of all skills
 * - Any other alias → skill content via `find()` with plural/singular fallback
 *   and automatic `expandIncludes`
 *
 * Compatible with `fabricTool()` for Llm.operate toolkits and
 * `suite.register()` for MCP servers.
 */
export function createSkillService(store: SkillStore) {
  return fabricService({
    alias: "skill",
    description:
      "Access development documentation. Pass a skill alias to get that documentation. Pass 'index' or no argument to list all available skills.",
    input: {
      alias: {
        description:
          "Skill alias (e.g., 'aws', 'tests'). Omit or use 'index' to list all skills.",
        required: false,
        type: String,
      },
    },
    service: async ({ alias: inputAlias }: { alias?: string }) => {
      const alias = normalizeAlias(inputAlias || "index");

      if (!isValidAlias(alias)) {
        throw new Error(
          `Invalid skill alias "${alias}". Use alphanumeric characters, hyphens, and underscores only.`,
        );
      }

      if (alias === "index") {
        const allSkills = await store.list();
        // Filter out index entries from every layer
        const skills = allSkills.filter(
          (s: SkillRecord) =>
            s.alias !== "index" && !s.alias.endsWith(":index"),
        );
        const skillList = skills.map(formatSkillListItem).join("\n");
        return `# Index of Skills\n\n${skillList}`;
      }

      const skill = await store.find(alias);

      if (!skill) {
        throw new Error(
          `Skill "${alias}" not found. Use skill("index") to list available skills.`,
        );
      }

      // Expand includes (no-op when skill has no includes)
      const content = await expandIncludes(store, skill);

      // Detect plural/singular fallback by comparing inner aliases
      const separatorIdx = alias.indexOf(":");
      const inputInnerAlias =
        separatorIdx === -1 ? alias : alias.slice(separatorIdx + 1);
      const skillSepIdx = skill.alias.indexOf(":");
      const skillInnerAlias =
        skillSepIdx === -1 ? skill.alias : skill.alias.slice(skillSepIdx + 1);

      if (skillInnerAlias !== inputInnerAlias) {
        return `<!-- resolved: ${skill.alias} -->\n\n${content}`;
      }

      return content;
    },
  });
}
