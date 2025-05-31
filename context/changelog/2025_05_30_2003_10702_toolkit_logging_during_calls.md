# Toolkit logging during calls

packages/llm/src/providers/openai/__tests__/operate.spec.ts
packages/llm/src/providers/openai/operate.ts
packages/llm/src/tools/__tests__/Toolkit.class.test.ts
packages/llm/src/tools/Toolkit.class.ts
packages/llm/src/types/LlmProvider.interface.ts
packages/llm/src/types/LlmTool.interface.ts

In Toolkit.class I want to allow a new option, log, which may be false or a function but defaults true.
If it is false, nothing changes.
If it is true, when `call` is invoked, just before `const result = tool.call(parsedArgs);`, a new function `logToolCall` is called with `parsedArgs` and a `context` object containing the `name` of the tool.

```typescript
import { JAYPIE, log as jaypieLog } from "@jaypie/core";

const log = log.lib({ lib: JAYPIE.LIB.AWS });

function logToolCall(args, context) {
  log.trace.var({ [context.name]: args });
}
```

If it is a function, instead of calling log call the function.
If it return a promise, await it.

Wrap the log or logToolCall call in a try/catch.

If it catches call:
```typescript
log.error("Caught error during logToolCall");
log.var({ error });
log.debug("Continuing...");
```