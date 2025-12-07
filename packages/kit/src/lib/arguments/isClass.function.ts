const isClass = (subject: unknown): boolean => {
  if (typeof subject !== "function") {
    return false;
  }

  // Check if the function starts with the class keyword
  const funcStr = Function.prototype.toString.call(subject);
  if (funcStr.startsWith("class")) {
    return true;
  }

  return false;
};

export default isClass;
