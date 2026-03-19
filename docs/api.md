# API Surface

---

## `defineLink(config)` → `LinkDefinition`

Creates a `LinkDefinition` that bundles procedure handlers and event listeners. TS infers all types from handlers — no manual type maps needed. Pass the result to `MsgLink` constructor or `createPair`.

```ts
import { defineLink } from '@byterygon/portex';

export const myDef = defineLink({
  procedures: {
    double: (n: number, ctx) => n * 2,
    upload: async (file: File, ctx) => {
      ctx.progress({ pct: 0.5 });
      return 'ok';
    },
  },
  on: {
    tick: (payload: { count: number }) => console.log(payload.count),
  },
});
// typeof myDef carries full inferred types
```

**Partial registration is OK** — missing handlers can be added later via `.procedure()` / `.on()`.

**Runtime:** `defineLink` is a trivial identity function — it returns `config` as-is with the type brand attached. Zero overhead.

```ts
function defineLink(config) {
  return config as LinkDefinition<InferredProcedures, InferredEvents>;
  // TS infers InferredProcedures/InferredEvents from config's handler signatures
}
```

---

## `.procedure(name, handler)` → `this`

Handler receives `(...args, ctx: ProcedureContext)`. The last argument is **always ctx** — don't forget when destructuring.

```ts
link.procedure('processFile', async (file: File, ctx) => {
  // ctx.signal    — AbortSignal
  // ctx.progress  — send feedback to caller (can include transfer)
  // ctx.transfer  — mark transferables for response

  for (let i = 0; i < steps.length; i++) {
    if (ctx.signal.aborted) throw new Error('aborted');
    ctx.progress({ step: i, total: steps.length });
    await steps[i](file);
  }
  return result;
});
```

**Transfer in handler:**

```ts
link.procedure('render', async (data, ctx) => {
  const pixels = new ArrayBuffer(width * height * 4);
  // ... fill pixels ...

  // Transfer progress data (zero-copy)
  const preview = pixels.slice(0, 1024);
  ctx.progress({ preview }, [preview]);

  // Transfer response — mark before returning
  ctx.transfer([pixels]);
  return { pixels, width, height };
});
```

**Important notes on abort in handler:**

- If handler throws after `signal.aborted === true` → callee sends `{ aborted: true }` instead of `{ error }`
- Handler should check `ctx.signal.aborted` at checkpoints, not continuously
- Can use `ctx.signal.throwIfAborted()` (ES2023+) for brevity

---

## `.call(method, ...args, options?)` → `Promise<T>`

Options object (`{ signal, onProgress, transfer }`) is auto-detected if it's the last argument and contains at least one of those keys.

```ts
const controller = new AbortController();

const result = await link.call('processFile', file, {
  signal: controller.signal,
  onProgress: ({ step, total }) => {
    updateProgressBar(step / total);
  },
});

// Cancel at any time:
controller.abort();
// → Promise rejects with DOMException { name: 'AbortError' }
```

**Transfer ownership on call:**

```ts
const buffer = new ArrayBuffer(1024);
await link.call('upload', buffer, {
  transfer: [buffer], // zero-copy — buffer is neutered on caller side
});
```

### Options Detection Caveat

The last argument is treated as `CallOptions` if it is a non-null object containing at least one of the keys `signal`, `onProgress`, or `transfer`:

```ts
typeof lastArg === 'object' &&
  lastArg !== null &&
  ('signal' in lastArg || 'onProgress' in lastArg || 'transfer' in lastArg);
```

**If a procedure's last data argument happens to be an object with one of those keys, it will be misinterpreted as options and stripped from the args sent over the wire.**

Workarounds:

1. Wrap the ambiguous argument: `link.call("method", { data: ambiguousArg })`
2. Pass an explicit empty options object: `link.call("method", ambiguousArg, {})`

This is a deliberate trade-off for API ergonomics — requiring an explicit options arg on every call would be verbose for the common case.

**Abort behavior:**

1. Caller deletes from `pending` map immediately
2. Caller sends `{ type: 'abort', id }` to callee
3. Caller rejects Promise with `AbortError`
4. Callee receives abort → fires `abortController.abort()` → `ctx.signal.aborted = true`
5. Callee sends `{ type: 'response', id, aborted: true }` — ignored because caller already deleted pending

**Detecting AbortError:**

```ts
try {
  await link.call('slow', data, { signal });
} catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    // cancelled — not a real error
  }
}
```

---

## `.ready()` → `void`

Sends `{ type: 'ready' }` to the other side to signal readiness. **Call only once.**

```ts
// Inside Worker — after setup is complete (possibly after dynamic import)
const { processFile } = await import('./heavy-processor.js');

const myDef = defineLink({
  procedures: {
    processFile: (file: File, ctx) => processFile(file, ctx),
    ping: (ctx) => 'pong' as const,
  },
});

const link = new MsgLink(self, myDef);
link.ready(); // ← tell the other side: I'm ready
```

---

## `.waitForReady()` → `Promise<void>`

Waits until `{ type: 'ready' }` is received from the other side. Resolves immediately if already received.

```ts
import type { remoteDef } from './remote-side';
const link = new MsgLink<typeof localDef, typeof remoteDef>(port, localDef, { waitReady: true });
await link.waitForReady();
```

---

## Auto-Queue with `waitReady: true`

When initialized with `{ waitReady: true }`, MsgLink **automatically buffers** all outgoing messages (`.call()`, `.emit()`) until `{ type: 'ready' }` is received. No need to call `waitForReady()` before each call.

```ts
// Call immediately, no need to await waitForReady()
import type { remoteDef } from './remote-side';
const link = new MsgLink<typeof localDef, typeof remoteDef>(port, localDef, { waitReady: true });

const r = await link.call('double', 21);
// ↑ message is queued → flushed when remote side calls .ready()
// → Promise resolves normally after remote side processes it
```

**Detailed behavior:**

- **`waitReady: true`**:
  - `.call()` → request message is queued, Promise returns immediately (pending until flush + response)
  - `.emit()` → event message is queued, flushed on ready
  - On receiving `{ type: 'ready' }` → flush entire queue in FIFO order → switch to direct sending
  - `.waitForReady()` → resolves on ready (optional, use if you need to know the exact moment)
- **`waitReady: false`** (default):
  - Sends directly, no queue — both sides are ready immediately (e.g. synchronous `createPair`) or the side knows it's ready
  - `.ready()` and `.waitForReady()` still work but do not affect queuing
- `ready()` sends a single message, no ack — fire-and-forget
- `destroy()` rejects all queued calls and rejects `waitForReady()` if pending

---

## `.emit(name, payload?, transfer?)` → `void`

Fire-and-forget event. No id, no response, no abort.

```ts
const buffer = new ArrayBuffer(4096);
link.emit('dataReady', { buffer, size: 4096 }, [buffer]); // zero-copy transfer
```

---

## `.on<T>(name, handler)` → `() => void`

Subscribe to event. Returns an unsubscribe function.

---

## `.off(name, handler)` → `void`

---

## `.destroy()` → `void`

- Removes message listener
- Rejects all `pending` calls with `new Error('MsgLink destroyed')`
- Rejects all queued calls (if `waitReady: true` and ready not yet received)
- Rejects `waitForReady()` promise if pending
- Aborts all `active` calls (callee side)
- Clears procedures and event handlers

---

## Factory: `createPair`

Only `createPair` exists as a factory — all other transports use `new MsgLink(port, def?, options?)` directly.

```ts
createPair<TBDef extends LinkDefinition = LinkDefinition>(
  bDef?: TBDef,
): [MsgLink<LinkDefinition, TBDef>, MsgLink<TBDef, LinkDefinition>];
```

- **`a` (index 0)** — caller side, untyped locally. `a.call()` typed against `TBDef`.
- **`b` (index 1)** — callee side, exposes `bDef`'s procedures.

For bidirectional typed testing where both sides have definitions, use `new MsgLink(port, def, options)` directly with a `MessageChannel`.

> **Rule:** the side that **calls `.ready()`** uses `waitReady: false` (it knows it's ready).
> The side that **waits** uses `waitReady: true` (needs to queue until ready is received).
> `createPair()` — both sides are ready immediately → both use `waitReady: false`.
