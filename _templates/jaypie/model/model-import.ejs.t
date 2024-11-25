---
inject: true
to: <%= workspace %>/<%= path %>/<%= exportFile %>
before: \#hygen-jaypie-model-import
skip_if: 'import <%= name %>Schema'
---
import <%= name %>Schema from "./<%= name %>.schema.js";