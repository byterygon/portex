import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createPair, defineLink } from '../src/index.ts';
import type { MsgLink, ProcedureContext } from '../src/index.ts';

const bDef = defineLink({
  procedures: {
    count: async (ctx: ProcedureContext) => {
      ctx.progress(1);
      ctx.progress(2);
      ctx.progress(3);
      return 'done';
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

describe('Progress', () => {
  test('progress callbacks fire in order', async () => {
    const received: unknown[] = [];
    const result = await a.call('count', { onProgress: (d: unknown) => received.push(d) });
    expect(received).toEqual([1, 2, 3]);
    expect(result).toBe('done');
  });

  test('no progress after handler returns (settled guard)', async () => {
    const received: unknown[] = [];

    b.procedure('leaky', async (ctx: ProcedureContext) => {
      const result = 'ok';
      setTimeout(() => ctx.progress('late'), 10);
      return result;
    });

    await a.call('leaky', { onProgress: (d: unknown) => received.push(d) });
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toHaveLength(0);
  });

  test('onProgress not provided — silently ignored', async () => {
    const result = await a.call('count');
    expect(result).toBe('done');
  });

  test('rpc via .procedure() with progress', async () => {
    b.procedure('steps', async (ctx: ProcedureContext) => {
      ctx.progress('a');
      ctx.progress('b');
      return 'end';
    });

    const received: unknown[] = [];
    const result = await a.call('steps', { onProgress: (d: unknown) => received.push(d) });
    expect(received).toEqual(['a', 'b']);
    expect(result).toBe('end');
  });
});
