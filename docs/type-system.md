# Type-Safe Constraints

`MsgLink` is a generic class: `MsgLink<TLocal, TRemote>` where both params are `LinkDefinition`s. Users declare the shape via `defineLink()` — the compiler enforces all method names, args, return types, and event payloads.

---

## Declaring Types with `defineLink`

No manual type maps needed — TS infers everything from handlers:

```ts
import { defineLink } from '@byterygon/portex';

export const myDef = defineLink({
  procedures: {
    double: (n: number, ctx) => n * 2,
    processFile: async (file: File, ctx) => {
      ctx.progress({ step: 1, total: 10 });
      return 'done';
    },
    ping: (ctx) => 'pong' as const,
  },
  on: {
    statusChanged: (payload: { status: string; ts: number }) => console.log(payload.status),
  },
});

// TS infers from handlers → LinkDefinition<
//   { double: { args: [number]; return: number };
//     processFile: { args: [File]; return: string; progress: { step: number; total: number } };
//     ping: { args: []; return: "pong" } },
//   { statusChanged: { status: string; ts: number } }
// >

// Other side extracts types via typeof:
//   import type { myDef } from "./this-file";
//   type Procs  = InferProcedures<typeof myDef>;
//   type Events = InferEvents<typeof myDef>;
```

---

## Generic Signature of MsgLink

```ts
class MsgLink<
  TLocal extends LinkDefinition = LinkDefinition,
  TRemote extends LinkDefinition = LinkDefinition,
> {
  // Overload 1: raw port + options (backward compat / advanced)
  constructor(port: PortexPort, options?: MsgLinkOptions);

  // Overload 2: port + local definition (registers procedures & event handlers)
  constructor(port: PortexPort, definition: TLocal, options?: MsgLinkOptions);

  // TProcedures/TEvents on .call()/.on() come from TRemote
  // TProcedures/TEvents on .procedure()/.emit() come from TLocal
}
```

Internally, when a `LinkDefinition` is passed:

- Each key in `definition.procedures` → calls `this.procedure(name, handler)`
- Each key in `definition.on` → calls `this.on(name, handler)`

This is pure sugar — no new runtime behavior.

---

## Constraints Per Method

Type aliases for clarity:

```ts
// Resolve procedure/event maps from LinkDefinition
type LocalProcs = InferProcedures<TLocal>; // procedures this side exposes
type LocalEvents = InferEvents<TLocal>; // events this side emits
type RemoteProcs = InferProcedures<TRemote>; // procedures the other side exposes
type RemoteEvents = InferEvents<TRemote>; // events the other side emits
```

```ts
// Helper: resolve progress type, default unknown if not declared
type ResolveProgress<TDef> = TDef extends { progress: infer P } ? P : unknown;

// .procedure() — register local handler (typed against LocalProcs)
procedure<K extends keyof LocalProcs & string>(
  name: K,
  handler: (...args: [
    ...LocalProcs[K]["args"],
    ProcedureContext<ResolveProgress<LocalProcs[K]>>
  ]) => LocalProcs[K]["return"] | Promise<LocalProcs[K]["return"]>
): this;

// .call() — call remote procedure (typed against RemoteProcs)
call<K extends keyof RemoteProcs & string>(
  method: K,
  ...args: [...RemoteProcs[K]["args"]]
    | [...RemoteProcs[K]["args"], CallOptions<ResolveProgress<RemoteProcs[K]>>]
): Promise<RemoteProcs[K]["return"]>;

// .emit() — emit local event (typed against LocalEvents)
emit<K extends keyof LocalEvents & string>(
  name: K,
  ...args: LocalEvents[K] extends void
    ? [transfer?: Transferable[]]
    : [payload: LocalEvents[K], transfer?: Transferable[]]
): void;

// .on() — listen for remote events (typed against RemoteEvents)
on<K extends keyof RemoteEvents & string>(
  name: K,
  handler: RemoteEvents[K] extends void ? () => void : (payload: RemoteEvents[K]) => void,
): () => void;

// .off() — same as .on()
off<K extends keyof RemoteEvents & string>(
  name: K,
  handler: RemoteEvents[K] extends void ? () => void : (payload: RemoteEvents[K]) => void,
): void;
```

---

## Usage Examples (Compile-Time Checks)

### With `defineLink` (recommended)

```ts
// ========== side-a.ts (e.g. Worker script) ==========
import { defineLink, MsgLink } from '@byterygon/portex';
import type { sideBDef } from './side-b'; // type-only, erased at runtime ✅

export const sideADef = defineLink({
  procedures: {
    double: (n: number, ctx) => n * 2,
    processFile: async (file: File, ctx) => {
      ctx.progress({ step: 1, total: 10 }); // typed ✅
      return 'done';
    },
  },
  on: {
    statusChanged: (payload: { status: string; ts: number }) => console.log(payload),
  },
});

const link = new MsgLink<typeof sideADef, typeof sideBDef>(self, sideADef);
link.ready();

// ========== side-b.ts (e.g. Main thread) ==========
import { defineLink, MsgLink } from '@byterygon/portex';
import type { sideADef } from './side-a'; // type-only, erased at runtime ✅

export const sideBDef = defineLink({
  procedures: {
    notify: (msg: string, ctx) => {
      /* ... */
    },
  },
});

const link = new MsgLink<typeof sideBDef, typeof sideADef>(worker, sideBDef, { waitReady: true });

// ✅ Call remote procedures — typed from sideADef (inferred from handlers)
const r = await link.call('double', 21); // r: number
await link.call('processFile', file, {
  onProgress: (p) => console.log(p.step, p.total), // p: { step, total } ✅
});

// ✅ Listen to remote events — typed from sideADef
link.on('statusChanged', (payload) => {
  /* ... */
});

// ❌ Compile errors
await link.call('double', 'not a number'); // arg type mismatch
await link.call('unknown'); // not in sideADef
```

### Without `defineLink` (backward compat)

`.procedure()` and `.on()` still work for incremental setup:

```ts
const link = new MsgLink(port);
link.procedure('double', (n: number, ctx) => n * 2);
link.on('ping', () => {
  /* ... */
});
```

---

## Bidirectional Typing with `defineLink`

Each side defines its own `LinkDefinition` and imports the other side's **type**:

```ts
// ========== side-a.ts ==========
export const sideADef = defineLink({ ... });

import type { sideBDef } from "./side-b";  // erased at runtime ✅
const link = new MsgLink<typeof sideADef, typeof sideBDef>(port, sideADef);

// link.call(...)  → typed against sideBDef (remote)
// link.procedure(...) → typed against sideADef (local)

// ========== side-b.ts ==========
export const sideBDef = defineLink({ ... });

import type { sideADef } from "./side-a";  // erased at runtime ✅
const link = new MsgLink<typeof sideBDef, typeof sideADef>(port, sideBDef, { waitReady: true });

// link.call(...)  → typed against sideADef (remote)
// link.procedure(...) → typed against sideBDef (local)
```

Circular `import type` between files is safe — TypeScript erases them completely.

> **Note:** Generics are enforced at compile-time only. The wire protocol remains `unknown` — no runtime validation in core (see "Not in Core").

---

## Utility Types (Exported for Users)

```ts
// Extract from LinkDefinition (primary use case — cross-side type sharing)
type InferProcedures<T> = T extends LinkDefinition<infer P, any> ? P : never;
type InferEvents<T> = T extends LinkDefinition<any, infer E> ? E : never;

// Also works on MsgLink instances
type InferLocalProcedures<T> = T extends MsgLink<infer L, any> ? InferProcedures<L> : never;
type InferRemoteProcedures<T> = T extends MsgLink<any, infer R> ? InferProcedures<R> : never;

// Use when defining handlers separately — progress type is also resolved
type ProcedureHandler<TDef extends { args: unknown[]; return: unknown; progress?: unknown }> = (
  ...args: [...TDef['args'], ProcedureContext<ResolveProgress<TDef>>]
) => TDef['return'] | Promise<TDef['return']>;
```
