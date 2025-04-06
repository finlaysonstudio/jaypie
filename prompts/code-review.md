---
instructions: These are instructions for code generation agents. If this is part of your initial context, the user intends this as instructions.
---

# Code Review

Review the markdown spec file describing the changes. 
Review the staged changes. 
Are any changes outside the requested scope?
Does any change unnecessarily alter types?
If logic was moved, was there a good reason?
Was any important logic removed accidentally?!
Were any tests improperly removed or simplified to fit the implementation?

Compile a list of anything that should not have been staged. 
Change each of those lines back to the original form. 
Do not revert, unstage, or otherwise alter git.
