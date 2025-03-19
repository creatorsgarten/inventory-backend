# CLAUDE.md - Creatorsgarten Inventory Backend

## Build & Run Commands
- **Run dev server**: `deno task dev` or `deno serve --watch -R main.ts`
- **Run all tests**: `deno test`
- **Run single test**: `deno test --filter "testName" main_test.ts`
- **Format code**: `deno fmt`
- **Lint code**: `deno lint`
- **Type check**: `deno check main.ts`

## Code Style Guidelines
- **Framework**: Elysia on Deno
- **Imports**: Use JSR for standard libraries, NPM for other packages
- **Types**: Always use TypeScript types
- **Naming**:
  - Use camelCase for variables and functions
  - Use PascalCase for classes and types
- **Error handling**: Use try/catch blocks with specific error types
- **Testing**: All endpoints should have corresponding tests
- **Documentation**: Add JSDoc comments for public APIs
- **Line length**: Keep lines under 80 characters when possible