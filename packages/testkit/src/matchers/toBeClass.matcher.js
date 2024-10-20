//
//
// Main
//

const toBeClass = (received) => {
  let pass = false;
  if (typeof received === "function") {
    try {
      new received();
      pass = true;
      // eslint-disable-next-line no-unused-vars
    } catch (error) {
      pass = false;
    }
  }
  if (pass) {
    return {
      message: () => `expected ${received} not to be a class`,
      pass: true,
    };
  }
  return {
    message: () => `expected ${received} to be a class`,
    pass: false,
  };
};

//
//
// Export
//

export default toBeClass;
