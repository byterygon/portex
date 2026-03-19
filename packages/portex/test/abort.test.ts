import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createPair, defineLink } from '../src/index.ts';
import type { MsgLink, ProcedureContext } from '../src/index.ts';

const bDef = defineLink({
  procedures: {
    slow: async (ctx: ProcedureContext) => {
      await new Promise<void>((_, reject) => {
        ctx.signal.addEventListener('abort', () => reject(new Error('aborted')));
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
    },
  },
});

let a: MsgLink, b: MsgLink;

beforeEach(() => {
  [a, b] = createPair(bDef);
});

afterEach(() => {
  a.destroy();
  b.destroy();
});

describe('Abort', () => {
  test('abort from caller', async () => {
    const controller = new AbortController();
    const promise = a.call('slow', { signal: controller.signal });
    controller.abort();
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  test('pre-aborted signal', async () => {
    const signal = AbortSignal.abort();
    await expect(a.call('slow', { signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  test('no progress after abort', async () => {
    const controller = new AbortController();
    const received: unknown[] = [];

    b.procedure('leak', async (ctx: ProcedureContext) => {
      await new Promise((r) => setTimeout(r, 50));
      ctx.progress('should not arrive');
    });

    const p = a.call('leak', {
      signal: controller.signal,
      onProgress: (d: unknown) => received.push(d),
    });
    controller.abort();
    await p.catch(() => {});
    await new Promise((r) => setTimeout(r, 100));
    expect(received).toHaveLength(0);
  });

  test('ctx.signal.aborted is true after caller aborts', async () => {
    let signalAborted = false;

    b.procedure('check', async (ctx: ProcedureContext) => {
      await new Promise<void>((resolve) => {
        ctx.signal.addEventListener('abort', () => {
          signalAborted = ctx.signal.aborted;
          resolve();
        });
      });
      return 'done';
    });

    const controller = new AbortController();
    const p = a.call('check', { signal: controller.signal });
    controller.abort();
    await p.catch(() => {});
    await new Promise((r) => setTimeout(r, 50));
    expect(signalAborted).toBe(true);
  });
});
