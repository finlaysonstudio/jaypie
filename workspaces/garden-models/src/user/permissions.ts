//
//
// Main
//

function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes("*")) return true;

  const [namespace] = required.split(":");
  if (userPermissions.includes(`${namespace}:*`)) return true;

  return userPermissions.includes(required);
}

function hasAllPermissions(
  userPermissions: string[],
  required: string[],
): boolean {
  return required.every((p) => hasPermission(userPermissions, p));
}

function hasAnyPermission(
  userPermissions: string[],
  required: string[],
): boolean {
  return required.some((p) => hasPermission(userPermissions, p));
}

//
//
// Export
//

export { hasAllPermissions, hasAnyPermission, hasPermission };
