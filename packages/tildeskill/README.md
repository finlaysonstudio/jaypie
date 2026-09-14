# Jaypie Tildeskill 🐦‍⬛

Skill/vocabulary management with pluggable storage backends.

- `createMarkdownStore`, `createMemoryStore`, and `createLayeredStore` from `@jaypie/tildeskill`
- `createDynamoDbStore` from `@jaypie/tildeskill/dynamodb` (requires the optional peer `@jaypie/dynamodb`)
- `syncSkills({ from, to })` copies one store into another
- `createSkillService(store)` serves any store as a fabric service

See [jaypie.net](https://jaypie.net) for documentation.

## 📜 License

[MIT License](./LICENSE.txt). Published by Finlayson Studio.
