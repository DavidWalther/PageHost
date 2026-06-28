# Copilot Instructions

## General behavior

- Always follow the instructions in this file when generating code.
- Never make assumptions; ask for clarification before generating code.
- Ask questions one by one instead of all at once.

## Workflow & conventions (canonical sources)

The binding project rules live in these files — follow them:

- **Workflow (Explore–Plan–Code):** `.github/instructions/epc.instructions.md`
- **Architecture & request flow:** `doc/architecture.md`
- **Frontend component conventions (Lit-first):** `doc/conventions.md`

## Development

- Make small, incremental changes with a commit after each change for a clear history.
- Commit messages: `<ComponentName>: short description of the change`.

### Backend development

- Use cases must be covered with tests.

### Frontend development

- Frontend components are not tested.

## Commands

- Running tests: `npm run test`
