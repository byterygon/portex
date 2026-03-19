import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createPair, defineLink } from '../src/index.ts';
import type { MsgLink } from '../src/index.ts';

const bDef = defineLink({
  procedures: {
    double: (n: number, _ctx) => n * 2,
    greet: (name: string, _ctx) => `hello ${name}`,
    throws: (_ctx) => {
      throw new Error('handler error');
    },
    asyncDouble: async (n: number, _ctx) => {
      await new Promise((r) => setTimeout(r, 10));
      return n * 2;
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

describe('RPC', () => {
  test('rpc via defineLink', async () => {
    expect(await a.call('double', 21)).toBe(42);
  });

  test('rpc with string arg', async () => {
    expect(await a.call('greet', 'world')).toBe('hello world');
  });

  test('async handler', async () => {
    expect(await a.call('asyncDouble', 5)).toBe(10);
  });

  test('handler throws returns error', async () => {
    await expect(a.call('throws')).rejects.toThrow('handler error');
  });

  test('unknown method rejects', async () => {
    await expect(a.call('nonexistent')).rejects.toThrow('Unknown procedure: nonexistent');
  });

  test('multiple concurrent calls', async () => {
    const [r1, r2, r3] = await Promise.all([
      a.call('double', 1),
      a.call('double', 2),
      a.call('double', 3),
    ]);
    expect(r1).toBe(2);
    expect(r2).toBe(4);
    expect(r3).toBe(6);
  });

  test('rpc via .procedure()', async () => {
    b.procedure('triple', (n: number, _ctx: unknown) => n * 3);
    expect(await a.call('triple', 7)).toBe(21);
  });

  test('call after destroy rejects', async () => {
    a.destroy();
    await expect(a.call('double', 1)).rejects.toThrow('MsgLink destroyed');
  });

  test('procedure after destroy throws', () => {
    a.destroy();
    expect(() => a.procedure('x', () => {})).toThrow('MsgLink destroyed');
  });
});
