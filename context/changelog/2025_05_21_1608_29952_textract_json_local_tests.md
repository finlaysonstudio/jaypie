# textract json local tests

context/prompts/Add_Vitest_Tests.md
packages/textract/src/__tests__/textractJsonToMarkdown.spec.ts
packages/textract/src/__tests__/__fixtures__/local - ignored in .gitignore

I would like to create a new test, textractJsonToMarkdown-local.spec.ts.
When run, it iterates over __fixtures__/local and runs "Document parses without warnings" for each json file (ending in json):

```
it("Document parses without warnings", () => {
  const result = textractJsonToMarkdown(completeDocument);
  expect(result).toBeDefined();
  expect(result).toBeString();
  expect(result).not.toBeEmpty();
  expect(log).not.toBeCalledAboveTrace();
});
```

It will have to reset mocks beforeEach.
If the directory is empty it should print the following:
`console.log("textractJsonToMarkdown-local.spec.ts called with empty __fixtures__/local. Add textract JSON data to check files parse without warnings.");`