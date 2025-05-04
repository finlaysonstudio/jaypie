# Project Plan from Brief

Review the provided project brief.
Assume the project brief was prepared by a product manager familiar with how users interact with the system but unfamiliar with the codebase.
Review the codebase considering the goals of the brief.

Create a new file, `plan.md`, or overwrite if it exists.
Write a step-by-step plan that is crystal-clear to a code generation agent.
Adjust code, guidance, and structure to match realities of the codebase when those conflict with statements in the brief.

## Audience

Write a plan for a code generator to guide development.

* Apply a crisp, declarative writing style
* Think about each phrase and how it can be written for maximum clarity
* Remove superfluous language, promotion, and claims
* Prefer semantic meaning (like headings) and clarity over aesthetic concerns (like font size)
* Assume the code generator does not have access to reasoning
* Assume the code generator does not have access to documentation and would benefit from code examples

Assume the code generation agent will:
* Invoke with a fully configured, tested local repository
* Not have the full source code; the agent will follow paths in the plan so be sure they are included
* Not have access to the project brief; carry over all code samples, details, and instructions

## Content

After writing introductory context, create a list of tasks that need to be performed.
Consider what tasks must be accomplished to achieve the goal.
Tasks are not a 1:1 mapping of objectives.
Some outcomes require multiple sequential tasks to be completed.
The scope of each task should be executable in 2-3 turns with a code generation agent applying diffs and calling tools.
Carefully consider the order of tasks.
Remove tasks only a human can perform.
Include documentation and tests in each step; do not create a task for updating documentation or tests.
Do not include performance optimizations or other improvements outside the user's requested scope.

### Tasks

Make sure the task section includes these instructions to optimize code generation:

* Tasks should be labeled _Queued_, _Dequeued_, and _Verified_
* Consider unlabeled tasks _Queued_
* Once development begins, mark a task _Dequeued_
* Do not move tasks to _Verified_ during the development process
* A separate verification process will tag tasks _Verified_
* The "first" or "next" task refers to the top-most _Queued_ task
* The "last" or "previous" task refers to the bottom-most _Dequeued_ task
* Only work on one task at a time
* Only work on the next task unless instructed to work on the last task
