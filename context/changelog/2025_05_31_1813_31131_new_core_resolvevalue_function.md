# New core resolveValue function

packages/core/src/lib/functions.lib.js

Create a new async function in packages/core/src/lib/functions called resolveValue.
export it from functions.lib.js.
resolveValue should take one parameter, valueOrFunction.
If valueOrFunction is not a function, return it.
If it is a function, call it.
If that returns a Promise, await it.
Return the function or promise result.
