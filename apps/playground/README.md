# Portex Playground

Interactive demo app for testing Portex features in the browser.

## Run

```bash
pnpm dev
```

## Demos

- **RPC** — basic procedure calls with `defineLink` and `createPair`
- **Abort** — cancel in-flight calls with `AbortController`
- **Progress** — stream progress feedback from handler to caller
- **Events** — fire-and-forget events between links
- **Transfer** — zero-copy `ArrayBuffer` transfer
- **Worker** — real Web Worker with `waitReady` handshake
- **Broadcast** — `BroadcastChannel` transport
- **Ready** — ready handshake flow
- **Destroy** — cleanup and pending call rejection
