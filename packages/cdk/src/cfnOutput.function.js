module.exports = ({ CfnOutput, output, stack } = {}) => {
  try {
    Object.keys(output).forEach((key) => {
      const value = output[key];
      if (
        value !== undefined &&
        typeof value === "string" &&
        value.length > 0
      ) {
        new CfnOutput(stack, key, { value });
      }
    });
  } catch (error) {
    console.warn(error);
    return false;
  }
  return true;
};
