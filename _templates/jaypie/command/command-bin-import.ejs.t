---
inject: true
to: <%= commandPath %>
before: \#hygen-jaypie-command-import
skip_if: '<%= name %>,'
---
<%= name %>,