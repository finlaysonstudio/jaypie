# Process: Update Mocks

Mocks in packages/testkit were recently refactored.
The refactored mocks are in packages/testkit/src/mock.

New utilities were added in packages/testkit/src/mock/utils.ts:
createMockResolvedFunction, createMockReturnedFunction, createMockWrappedFunction, createMockWrappedObject

Apply these utilities in the specified mock file.
Request clarification if no mock file is specified.
