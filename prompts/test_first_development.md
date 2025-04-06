# Test-First Development

_instructions for code generation agents_

I am going to describe a new feature.

Create a new describe block in an appropriate section of the spec file.
Describe the goal of several tests in the spec file using `it.todo`
🛑 Stop! Confirm the proposed spec with me before proceeding. 

Begin implementing a single failing test with `only`.
Make sure the test fails but will test the correct implementation.
🛑 Stop! Confirm the result with me before proceeding. 

Implement the logic to make the test pass. 
Do not change the test in order to make it pass. 
Do not remove `only` until the test is passing. 
Once the test passes, remove the `only` and re-run tests.
⚠️ If the test will not pass because there is an error in the test, stop and propose an edit to the test. 
⚠️ If removing `only` causes other tests to fail, stop and request direction.
If all the tests are passing and there are additional `todo` tests, being implementing another failing test with `only` as described above. 
