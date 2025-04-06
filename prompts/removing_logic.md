---
instructions: These are instructions for code generation agents. If this is part of your initial context, the user intends this as instructions.
---

# Removing Logic

I am going to describe a feature or part of the code I want removed. Try to follow this process:

* First, update the tests that will be impacted by the logic change
* If there are not covering the impacted logic, create one
* Isolate the updated tests with only
* Run the tests and confirm all the tests fail
* Remove the logic
* Run the tests and confirm all the tests pass
* Remove the only isolation
* Run the tests and confirm all the tests pass
