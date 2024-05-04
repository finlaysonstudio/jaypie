---
inject: true
to: <%= pathInput %>/<%= exportFileInput %>
before: \#hygen-jaypie-command
skip_if: 'default as <%= name %>'
---
export { default as <%= name %> } from "./<%= name %><%= dotSubtype %>.js";