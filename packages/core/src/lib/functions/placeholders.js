/* eslint-disable no-plusplus, no-shadow, no-param-reassign */

//
//
// Helper Functions
//

/*!
 * Get an object value from a specific path
 * (c) 2018 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param  {Object}       obj  The object
 * @param  {String|Array} path The path
 * @param  {*}            def  A default value to return [optional]
 * @return {*}                 The value
 */
function get(obj, path, def) {
  /**
   * If the path is a string, convert it to an array
   * @param  {String|Array} path The path
   * @return {Array}             The path array
   */
  const stringToPath = (path) => {
    // If the path isn't a string, return it
    if (typeof path !== "string") return path;

    // Create new array
    const output = [];

    // Split to an array with dot notation
    path.split(".").forEach((item) => {
      // Split to an array with bracket notation
      item.split(/\[([^}]+)\]/g).forEach((key) => {
        // Push to the new array
        if (key.length > 0) {
          output.push(key);
        }
      });
    });

    return output;
  };

  // Get the path as an array
  path = stringToPath(path);

  // Cache the current object
  let current = obj;

  // For each item in the path, dig into the object
  for (let i = 0; i < path.length; i++) {
    // If the item isn't found, return the default (or null)
    if (!current[path[i]]) return def;

    // Otherwise, update the current  value
    current = current[path[i]];
  }

  return current;
}

//
//
// Main
//

/*!
 * Replaces placeholders with real content
 * Requires get() - https://vanillajstoolkit.com/helpers/get/
 * (c) 2019 Chris Ferdinandi, MIT License, https://gomakethings.com
 * @param {String} template The template string
 * @param {String} local    A local placeholder to use, if any
 */
function placeholders(template, data) {
  // Check if the template is a string or a function
  template = typeof template === "function" ? template() : template;
  if (["string", "number"].indexOf(typeof template) === -1)
    throw Error("PlaceholdersJS: please provide a valid template");

  // If no data, return template as-is
  if (!data) return template;

  // Replace our curly braces with data
  template = template.replace(/\{\{([^}]+)\}\}/g, (match) => {
    // Remove the wrapping curly braces
    match = match.slice(2, -2);

    // Get the value
    const val = get(data, match.trim());

    // Replace
    if (!val) return `{{${match}}}`;
    return val;
  });

  return template;
}

//
//
// Export
//

export default placeholders;
