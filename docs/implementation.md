# Implementation Rules

---

## Ready Flow

```
Side A (waitReady: false):             Side B (waitReady: true):
───────────────────────────────────    ──────────────────────────────────────
// script loaded                       link.call("double", 21)
// defineLink({ procedures })            → queue: [{ type:'request', ... }]
// new MsgLink(port, localDef)         link.emit("ping")
link.ready()                             → queue: [req, { type:'event', ... }]
  → postMessage({ type:'ready' })
                                       → handleReady()
                                         → this._ready = true
                                         → resolve(waitForReady promise)
                                         → flush queue FIFO:
                                           postMessage(req)
                                           postMessage(event)
                                         → queue = null (send directly from here)
```

**When ready is needed:**

- Worker / iframe / BroadcastChannel — remote side needs time to load, use `waitReady: true`
- `createPair()` — **not needed** (synchronous, both sides ready immediately)
- The side that is "ready" must call `.ready()` to notify the other side

---

## Abort Flow

```
Caller side:                           Callee side:
─────────────────────────────────────  ────────────────────────────────────
signal.abort() fires
  → delete pending[id]
  → postMessage({ type:'abort', id })  → handleAbort()
  → reject(AbortError)                   → active[id].abortController.abort()
                                           → ctx.signal.aborted = true
                                           → handler checks & throws
                                           → catch: signal.aborted → true
                                           → postMessage({ aborted: true })
                                           (ignored — pending already deleted)
```

---

## Progress Flow

```
Callee:                                Caller:
───────────────────────────────────    ──────────────────────────────────────
ctx.progress({ pct: 0.3 })
  → if (activeCall.settled) return     (guard: no-op after settled)
  → postMessage({ type:'progress' })
                                       → handleProgress()
                                         → pending[id].onProgress?.(data)
                                         → user callback fires
```

---

## Invariants (Must Not Be Violated)

- `activeCall.settled = true` must be set **before** `this.active.delete(id)` and **before** postMessage response — so `ctx.progress()` won't fire after response
- When caller deletes `pending[id]` (due to abort), subsequent progress messages are **silently ignored** (correct behavior)
- `destroy()` sets `settled = true` on all active calls before aborting — prevents progress messages after destroy

---

## Not in Core

- No default timeout — users wrap with `AbortSignal.timeout(ms)`
- No schema validation — that's the application layer
- No logging — users hook via middleware (future feature)
- No retry logic

---

## Edge Cases & Defensive Behavior

| Scenario                               | Behavior                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.ready()` called twice                | No-op on second call. Guard with `_readySent` flag. Do not throw.                                                                                                               |
| `.destroy()` called twice              | No-op on second call. Guard with `_destroyed` flag. Do not throw.                                                                                                               |
| Response/progress for unknown `id`     | Silently ignore. This happens naturally when abort deletes pending before response arrives.                                                                                     |
| `postMessage` throws (port closed)     | For `.call()`: reject the pending promise with the caught error. For fire-and-forget (`.emit()`, `.ready()`, abort signal): swallow silently.                                   |
| Handler returns non-serializable value | `postMessage` for response will throw. Catch and send error response `{ type: 'response', id, error: 'Failed to serialize response: ...' }`. If that also fails, silently drop. |
| `.call()` after `.destroy()`           | Throw `new Error('MsgLink destroyed')`. Check `_destroyed` at top of method.                                                                                                    |
| `.emit()` after `.destroy()`           | Throw `new Error('MsgLink destroyed')`. Check `_destroyed` at top of method.                                                                                                    |
| `.procedure()` after `.destroy()`      | Throw `new Error('MsgLink destroyed')`.                                                                                                                                         |
| `.on()` / `.off()` after `.destroy()`  | Throw `new Error('MsgLink destroyed')`.                                                                                                                                         |
