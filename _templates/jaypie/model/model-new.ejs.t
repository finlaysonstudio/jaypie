---
inject: true
to: <%= workspace %>/<%= path %>/<%= exportFile %>
before: \#hygen-jaypie-model-new
skip_if: '<%= name %>Schema\),'
---
    <%= Name %>: () => model("<%= name %>", <%= name %>Schema),