const BASE62 =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

//
//
// Main
//

function computeChecksum(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    sum += body.charCodeAt(i);
  }
  const c0 = BASE62[sum % 62];
  const c1 = BASE62[(sum * 7 + 13) % 62];
  const c2 = BASE62[(sum * 11 + 29) % 62];
  const c3 = BASE62[(sum * 17 + 37) % 62];
  return `${c0}${c1}${c2}${c3}`;
}

//
//
// Export
//

export { computeChecksum };
