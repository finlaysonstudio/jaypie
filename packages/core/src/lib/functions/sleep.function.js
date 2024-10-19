//
//
// Constants
//

//
//
// Helper Functions
//

//
//
// Main
//

/** Does not sleep in test */
const sleep = async (milliseconds = 1000) => {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

//
//
// Export
//

export default sleep;
