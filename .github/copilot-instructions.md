# Copilot Instructions

- Work with the Explore-Plan-Develop cycle. Do not skip any of the steps in the cycle.

## Exploration

- create a deep and solid understanding of the problem before starting to plan or write code
- make no assumptions about the problem or the solution.
- Ask questions to clarify any uncertainties before proceeding to the next step.
- make sure to understand the relevant codebase
- save all insights and information in the file ./files/epcc/<Task>/exploration.md
- DO NOT CHANGE ANY CODE

## Planning

- create a detailed plan for implementing the feature or fixing the bug. The plan should include:
- save the plan in the file ./files/epcc/<Task>/plan.md
- the plan should have the following structure:

   - [ ] Main Step 1
      - [ ] Sub Step 1.1
      - [ ] Sub Step 1.2
      - ...
   - [ ] Main Step 2
      - [ ] Sub Step 2.1
      - [ ] Sub Step 2.2
      - ...
   - ...
- the plan should be as detailed as possible, breaking down the implementation into small, self-contained steps.
- commit the plan to git with a message that starts with "Plan: " followed by a brief description of the plan.
- DO NOT CHANGE ANY CODE

## Development

- implement the plan created in the previous step, following the steps in the plan one by one.
- after completing each main step, commit the changes. List all the completed steps in the commit message.
- For Backend
   - run tests before starting to code, and make sure all tests are passing.
   - after implementing the code, run tests again to make sure all tests are still passing.
   - run tests after completing each main step to ensure that the implementation is correct and does not break any existing functionality.
- mark the task as complete when all steps in the plan are completed and all tests are passing.

## commands

- running tests: `npm run test`