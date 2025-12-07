/** Does not sleep in test */
const sleep = async (milliseconds = 1000): Promise<void> => {
  if (process.env.NODE_ENV === "test") {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
};

export default sleep;
