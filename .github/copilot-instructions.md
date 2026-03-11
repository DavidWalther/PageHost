# Copilot Instructions

## gneral behavior

- Always follow the instructions in this file when generating code.
- never make any assumptions 
- ask for clarification if anything is not clear before generating code.
- ask questions one by one instead of all at once 

## Development

- make small incremental, meaningful changes towarsds the goal instead of trying to do everything at once
- make commit messages like "<ComponentName>: short description of the change" 

### Feature development

1. before starting run tests to eastablish a baseline
   1.1. on failure: abort and ask for help
   1.2. on success: create a new branch for the feature
2. create a test for the new feature first before implementing the feature
   2.1. on failure: this is expected, go to step 3
   2.2. on success: this is unexpected, abort and ask for help
3. commit the test to branch
4. make small incremental, meaningful changes towards the goal
5. add change to git staging area
6. run tests
   6.1. on failure: go back to step 4 and try to fix the issue
   6.2. on success: commit the changes and go back to step 4 until the feature is complete

## commands

- running tests: `npm run test`