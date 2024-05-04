---
to: <%= path %>/<%= name %><%= dotSubtype %>.js
---
import { Schema } from "mongoose";

//
//
// Schema Definition
//

const schema = new Schema(
  {
    uuid: {
      index: true,
      type: Schema.Types.UUID,
    },
  },
  { timestamps: true },
);

//
//
// Instance Methods
//

// Allow unnamed async functions in the instance methods block
/* eslint-disable func-names */

//

// Restore default behavior outside the instance methods block
/* eslint-enable func-names */

//
//
// Static Methods
//

// Allow unnamed async functions in the static methods block
/* eslint-disable func-names */

//

// Restore default behavior outside the static methods block
/* eslint-enable func-names */

//
//
// Export
//

export default schema;
