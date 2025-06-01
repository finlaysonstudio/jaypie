# refactor llm to use resolve value

packages/core/src/lib/functions/resolveValue.js
packages/llm/src/providers/openai/operate.ts
packages/llm/src/tools/Toolkit.class.ts
packages/llm/src/util/index.ts
packages/llm/src/util/resolvePromise.ts

The resolveValue function is new in @jaypie/core@1.1.11.
Update operate and Toolkit to make use of { resolveValue } from "@jaypie/core"
That makes resolvePromise obsolete; delete it.