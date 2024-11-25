---
to: <%= workspace %>/<%= path %>/<%= name %><%= dotSubtype %>.js
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
      type: Schema.Types.String,
    },
  },
  { timestamps: true },
);

//
//
// Export
//

export default schema;
