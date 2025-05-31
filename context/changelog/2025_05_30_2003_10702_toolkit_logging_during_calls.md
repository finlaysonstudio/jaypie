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

---

The above has already been completed.
I want to change `logToolCall` to `logToolMessage(message: string, context)`.
Move args to the context.
Check to see if `tool.message` exists.
If it is a string, use it.
If it is a function, call it.
If it returns a promise, await it.
If it is not a string, cast it to string.
If there is no message (if it is undefined or falsy) use `${tool}:${JSON.stringify(args)}` as the message