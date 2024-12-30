//
//
// Main
//

const isJaypieError = (error) => {
  const result =
    error && error.isProjectError === true && typeof error.json === "function";
  // TODO: and calling error.json() returns a JSON:API error object
  // - Which implies calling json() never has a side effect. This sounds correct and is thus far true
  if (result) {
    return true;
  }
  return false;
};

//
//
// Export
//

export default isJaypieError;
