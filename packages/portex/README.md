# @byterygon/portex

Lightweight bidirectional RPC over MessageChannel with typed procedures, events, abort, progress, and transferable support.

## Features

- **Bidirectional RPC** — call remote procedures, get typed results
- **Event push** — fire-and-forget events in either direction
- **AbortController** — cancel in-flight calls with native `AbortSignal`
- **Typed progress** — stream progress feedback from handler to caller
- **Transferable support** — zero-copy `ArrayBuffer` transfer on calls, events, and progress
- **Ready handshake** — queue messages until the remote side is ready
- **Type-safe** — full TypeScript inference via `defineLink()`, no manual type maps
- **Tiny** — under 2 KB gzipped

## Install

```bash
npm install @byterygon/portex
```

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

client.destroy();
server.destroy();
```

## Worker Example

```ts
// main.ts
import { MsgLink } from '@byterygon/portex';
import type { workerDef } from './worker';

const worker = new Worker('./worker.ts', { type: 'module' });
const link = new MsgLink<{}, typeof workerDef>(worker, { waitReady: true });

const result = await link.call('compute', 42);
// calls are queued until the worker signals ready
```

```ts
// worker.ts
import { MsgLink, defineLink } from '@byterygon/portex';

export const workerDef = defineLink({
  procedures: {
    compute: (n: number) => n * n,
  },
});

const link = new MsgLink(self, workerDef);
link.ready(); // flush queued messages on the main side
```

## Progress & Abort

```ts
const controller = new AbortController();

const result = await link.call('processFile', file, {
  signal: controller.signal,
  onProgress: ({ step, total }) => console.log(`${step}/${total}`),
});

// Cancel anytime:
controller.abort();
```

## API Overview

| Method                             | Description                                                     |
| ---------------------------------- | --------------------------------------------------------------- |
| `defineLink(config)`               | Create a typed `LinkDefinition` from handler functions          |
| `createPair(def?)`                 | Create a connected `[client, server]` pair via `MessageChannel` |
| `new MsgLink(port, def?, opts?)`   | Attach to any `MessageChannel`-compatible transport             |
| `.call(method, ...args, opts?)`    | Call a remote procedure, returns `Promise`                      |
| `.procedure(name, handler)`        | Register a procedure handler                                    |
| `.emit(name, payload?, transfer?)` | Send a fire-and-forget event                                    |
| `.on(name, handler)`               | Subscribe to events, returns unsubscribe function               |
| `.off(name, handler)`              | Unsubscribe from events                                         |
| `.ready()`                         | Signal readiness to the other side                              |
| `.waitForReady()`                  | Wait until the other side signals ready                         |
| `.destroy()`                       | Clean up listeners, reject pending calls                        |

## Documentation

- [Architecture & Wire Protocol](../../docs/architecture.md)
- [Type System](../../docs/type-system.md)
- [API Reference](../../docs/api.md)
- [Implementation Details](../../docs/implementation.md)
- [Testing Patterns](../../docs/testing.md)

## License

[MIT](../../LICENSE)
