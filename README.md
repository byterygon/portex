# Portex

> **Portex** turns any `MessageChannel`-compatible transport into a lightweight server:
> bidirectional RPC, event push, AbortController, typed progress feedback, and transferable support.

## Quick Start

```ts
import { defineLink, createPair } from '@byterygon/portex';

const serverDef = defineLink({
  procedures: {
    greet: (name: string) => `Hello, ${name}!`,
    add: (a: number, b: number) => a + b,
  },
});

const [client, server] = createPair(serverDef);

console.log(await client.call('greet', 'world')); // "Hello, world!"
console.log(await client.call('add', 1, 2)); // 3
```

## Features

- Bidirectional RPC with typed procedures
- Fire-and-forget events
- AbortController integration
- Typed progress feedback
- Transferable (zero-copy) support
- Ready handshake for async transports
- Full TypeScript inference via `defineLink()`
- Under 2 KB gzipped

## Packages

| Package                                 | Description          |
| --------------------------------------- | -------------------- |
| [`@byterygon/portex`](packages/portex/) | Core library         |
| [`playground`](apps/playground/)        | Interactive demo app |

## Documentation

| Document                                 | Content                                            |
| ---------------------------------------- | -------------------------------------------------- |
| [Architecture](docs/architecture.md)     | Wire protocol, public types, architecture overview |
| [Type System](docs/type-system.md)       | `defineLink`, generics, utility types              |
| [API Reference](docs/api.md)             | Full API surface with examples                     |
| [Implementation](docs/implementation.md) | Ready/Abort/Progress flows, invariants, edge cases |
| [Testing](docs/testing.md)               | Test patterns with Vitest                          |

## Development

```bash
pnpm install
pnpm nx build @byterygon/portex
pnpm nx test @byterygon/portex
```

See [CONTRIBUTING.md](.github/CONTRIBUTING.md) for more details.

## License

[MIT](LICENSE)
