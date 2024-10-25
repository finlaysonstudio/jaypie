module.exports = ({ CfnOutput, output, stack } = {}) => {
  try {
    Object.keys(output).forEach((key) => {
      const value = output[key];
      if (
        value !== undefined
        && typeof value === "string"
        && value.length > 0
      ) {
        new CfnOutput(stack, key, { value });
      }
    });
    // eslint-disable-next-line no-unused-vars
  } catch (error) {
    return false;
  }
  return true;
};
