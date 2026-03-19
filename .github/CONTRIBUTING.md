# Contributing

Thanks for your interest in contributing to Portex!

## Development Setup

1. Clone the repo and install dependencies:

   ```bash
   pnpm install
   ```

2. Run tests:

   ```bash
   pnpm nx test @byterygon/portex
   ```

3. Build:

   ```bash
   pnpm nx build @byterygon/portex
   ```

## Pull Requests

- Keep changes small and focused
- Add tests for new functionality
- Run `pnpm nx typecheck @byterygon/portex` before submitting
- Follow existing code style (enforced by Prettier + ESLint via pre-commit hooks)

## Changesets

Every PR that changes the public API or fixes a bug should include a changeset:

```bash
npx changeset
```

## Code of Conduct

Be respectful and constructive. We follow the [Contributor Covenant](https://www.contributor-covenant.org/).
