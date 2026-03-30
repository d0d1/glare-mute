# Development Workflow

## Preferred loops

### Fast UI loop

```bash
pnpm dev:web
```

Use this for frontend iteration, contract debugging, and Playwright review.

### Desktop loop

```bash
pnpm dev
```

Use this when working on tray behavior, logging, settings persistence, or native integrations.

## Agent-first expectations

- do not rely on manual user testing for basic validation
- use the diagnostics panel and log surfaces before asking for help
- prefer reproducible commands over ad-hoc clicking
- keep the browser preview healthy because it is the fastest review surface

## Local dependency policy

- JavaScript tooling is installed locally through `pnpm`
- Playwright browsers live under `.cache/ms-playwright`
- Python tooling should go in `.venv` if added later
- avoid global installs unless a tool genuinely cannot be used locally
