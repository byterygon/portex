# Architecture & Wire Protocol

> **Portex** turns any `MessageChannel`-compatible transport into a lightweight server:
> bidirectional RPC, event push, AbortController, typed progress feedback, and transferable support.

---

## Architecture Overview

```
Transport (MessageChannel / Worker / BroadcastChannel / iframe)
        ↕  postMessage / addEventListener
   ┌──────────────────────────────────────────────┐
   │                  MsgLink                     │
   │                                              │
   │  ready:         boolean (+ queue)            │  ← handshake state
   │  procedures:    Map<name, handler>           │  ← .procedure()
   │  eventHandlers: Map<name, Set<fn>>           │  ← .on()
   │  pending:       Map<id, PendingCall>         │  ← caller side: awaiting response
   │  active:        Map<id, ActiveCall>          │  ← callee side: processing
   └──────────────────────────────────────────────┘
```

---

## Wire Protocol

All messages carry `__portex: true`. **Do not change the shape** — it affects backward compatibility.

```ts
// RPC Request       caller → callee
{ __portex: true, type: 'request',  id, method, args }

// RPC Response      callee → caller
{ __portex: true, type: 'response', id, result? }          // success
{ __portex: true, type: 'response', id, error: string }    // handler threw
{ __portex: true, type: 'response', id, aborted: true }    // aborted

// Progress feedback callee → caller (0..N times before response)
{ __portex: true, type: 'progress', id, data: unknown }

// Abort signal      caller → callee (fire-and-forget)
{ __portex: true, type: 'abort',    id }

// Event             either direction (fire-and-forget, no id)
{ __portex: true, type: 'event',    name, payload }

// Ready handshake   callee → caller (fire-and-forget, once)
{ __portex: true, type: 'ready' }
```

ID format: `${Date.now()}-${counter}` — unique per session.

---

## Public Types

```ts
// PortexPort — minimal transport interface
type PortexPort = {
  postMessage(data: unknown, transfer?: Transferable[]): void;
  addEventListener(event: 'message', handler: (e: { data: unknown }) => void): void;
  removeEventListener(event: 'message', handler: (e: { data: unknown }) => void): void;
};

// Context injected into every procedure handler — generic on progress type
type ProcedureContext<TProgress = unknown> = {
  signal: AbortSignal;
  progress: (data: TProgress, transfer?: Transferable[]) => void;
  transfer: (objects: Transferable[]) => void; // mark transferables for response
};

// Options for .call() — generic on progress type
type CallOptions<TProgress = unknown> = {
  signal?: AbortSignal;
  onProgress?: (data: TProgress) => void;
  transfer?: Transferable[]; // transfer alongside args (request message)
};

// Options for MsgLink constructor
type MsgLinkOptions = {
  waitReady?: boolean; // default: false
  // true  → queue all outgoing messages until { type: 'ready' } is received
  // false → send immediately, no queue (default — used for createPair, same-thread)
};

// --- defineLink types ---

// LinkDefinition — returned by defineLink(), TS infers types from handlers
// TProcedures and TEvents are inferred, not manually declared
type LinkDefinition<
  TProcedures extends ProcedureMap = ProcedureMap,
  TEvents extends EventMap = EventMap,
> = {
  readonly procedures?: Record<string, (...args: any[]) => any>;
  readonly on?: Record<string, (...args: any[]) => void>;
  // phantom brand — no runtime value, exists only for type extraction
  readonly __types: { procedures: TProcedures; events: TEvents };
};
```
