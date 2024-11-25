---
inject: true
to: <%= workspace %>/package.json
after: scripts
skip_if: spec<%= colonSubspec %>.+<%= path %>/__tests__/<%= name %><%= dotSubtype %>.spec.js
sh: |
  if jq -e '.scripts["format:package"]' <%= workspace %>/package.json > /dev/null; then
    npm --prefix <%= workspace %> run format:package 2> /dev/null || true
  fi
---
    "test:spec<%= colonSubspec %>:<%= name %><%= dotSubtype %>": "vitest run ./<%= path %>/__tests__/<%= name %><%= dotSubtype %>.spec.js",