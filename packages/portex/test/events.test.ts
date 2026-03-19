import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { createPair, defineLink } from '../src/index.ts';
import type { MsgLink } from '../src/index.ts';

const bDef = defineLink({
  on: {
    ping: (_payload: { ts: number }) => {},
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

describe('Events', () => {
  test('emit + on basic flow', async () => {
    const received: unknown[] = [];
    a.on('ping', (payload) => received.push(payload));
    b.emit('ping', { ts: 123 });

    await new Promise((r) => setTimeout(r, 50));
    expect(received).toEqual([{ ts: 123 }]);
  });

  test('.off() removes handler', async () => {
    const received: unknown[] = [];
    const handler = (payload: unknown) => received.push(payload);
    a.on('ping', handler);
    a.off('ping', handler);
    b.emit('ping', { ts: 1 });

    await new Promise((r) => setTimeout(r, 50));
    expect(received).toHaveLength(0);
  });

  test('unsubscribe function from .on()', async () => {
    const received: unknown[] = [];
    const unsub = a.on('ping', (payload) => received.push(payload));
    unsub();
    b.emit('ping', { ts: 1 });

    await new Promise((r) => setTimeout(r, 50));
    expect(received).toHaveLength(0);
  });

  test('multiple handlers for same event', async () => {
    const r1: unknown[] = [];
    const r2: unknown[] = [];
    a.on('ping', (p) => r1.push(p));
    a.on('ping', (p) => r2.push(p));
    b.emit('ping', { ts: 99 });

    await new Promise((r) => setTimeout(r, 50));
    expect(r1).toEqual([{ ts: 99 }]);
    expect(r2).toEqual([{ ts: 99 }]);
  });

  test('emit after destroy throws', () => {
    b.destroy();
    expect(() => b.emit('ping', { ts: 1 })).toThrow('MsgLink destroyed');
  });

  test('on after destroy throws', () => {
    a.destroy();
    expect(() => a.on('test', () => {})).toThrow('MsgLink destroyed');
  });

  test('off after destroy throws', () => {
    a.destroy();
    expect(() => a.off('test', () => {})).toThrow('MsgLink destroyed');
  });
});
