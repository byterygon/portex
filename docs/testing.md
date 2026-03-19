# Test Patterns

```ts
import { createPair, defineLink } from '@byterygon/portex';
import type { MsgLink, ProcedureContext } from '@byterygon/portex';

// --- defineLink: types inferred from handlers ---
const bDef = defineLink({
  procedures: {
    double: (n: number, ctx) => n * 2,
  },
});

let a: MsgLink, b: MsgLink;

beforeEach(() => {
  [a, b] = createPair<typeof bDef>(bDef);
});
afterEach(() => {
  a.destroy();
  b.destroy();
});

// --- Basic RPC (handler registered via defineLink) ---
test('rpc via defineLink', async () => {
  expect(await a.call('double', 21)).toBe(42);
});

// --- Incremental .procedure() still works ---
test('rpc via .procedure()', async () => {
  b.procedure('count', async (ctx) => {
    ctx.progress(1);
    ctx.progress(2);
    ctx.progress(3);
    return 'done';
  });

  const received: unknown[] = [];
  await a.call('count', { onProgress: (d) => received.push(d) });
  expect(received).toEqual([1, 2, 3]);
});

// --- Abort from caller ---
test('abort from caller', async () => {
  const controller = new AbortController();

  b.procedure('slow', async (ctx) => {
    await new Promise<void>((_, reject) => {
      ctx.signal.addEventListener('abort', () => reject(new Error('aborted')));
      setTimeout(() => reject(new Error('timeout')), 5000);
    });
  });

  const promise = a.call('slow', { signal: controller.signal });
  controller.abort();

  await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
});

// --- Pre-aborted signal ---
test('pre-aborted signal', async () => {
  const signal = AbortSignal.abort();
  await expect(a.call('slow', { signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
});

// --- No progress after abort ---
test('no progress after abort', async () => {
  const controller = new AbortController();
  const received: unknown[] = [];

  b.procedure('leak', async (ctx) => {
    await new Promise((r) => setTimeout(r, 50));
    ctx.progress('should not arrive'); // settled=true after abort, no-op
  });

  const p = a.call('leak', {
    signal: controller.signal,
    onProgress: (d) => received.push(d),
  });
  controller.abort();
  await p.catch(() => {});
  await new Promise((r) => setTimeout(r, 100));
  expect(received).toHaveLength(0);
});

// --- Destroy rejects pending ---
test('destroy rejects pending', async () => {
  b.procedure('forever', () => new Promise(() => {}));
  const p = a.call('forever');
  a.destroy();
  await expect(p).rejects.toThrow('MsgLink destroyed');
});
```
