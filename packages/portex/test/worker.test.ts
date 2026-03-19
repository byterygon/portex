import { describe, test, expect } from 'vitest';
import { defineLink, MsgLink } from '../src/index.ts';

describe('Ready flow', () => {
  test('waitReady queues messages and flushes on ready', async () => {
    const channel = new MessageChannel();

    const workerDef = defineLink({
      procedures: {
        double: (n: number, _ctx) => n * 2,
      },
    });

    // "main" side — waits for worker to be ready
    const main = new MsgLink(channel.port1, { waitReady: true });
    // "worker" side — has procedures, will signal ready
    const worker = new MsgLink(channel.port2, workerDef);

    // Call before ready — should be queued
    const promise = main.call('double', 21);

    // Signal ready
    worker.ready();

    const result = await promise;
    expect(result).toBe(42);

    main.destroy();
    worker.destroy();
  });

  test('waitForReady resolves when ready received', async () => {
    const channel = new MessageChannel();
    const main = new MsgLink(channel.port1, { waitReady: true });
    const worker = new MsgLink(channel.port2);

    let resolved = false;
    const p = main.waitForReady().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);
    worker.ready();
    await p;
    expect(resolved).toBe(true);

    main.destroy();
    worker.destroy();
  });

  test('waitForReady resolves immediately if already ready', async () => {
    const channel = new MessageChannel();
    const main = new MsgLink(channel.port1); // waitReady: false (default)

    await main.waitForReady(); // should resolve immediately

    main.destroy();
    channel.port2.close();
  });

  test('.ready() is idempotent', () => {
    const channel = new MessageChannel();
    const link = new MsgLink(channel.port1);

    // Should not throw on second call
    link.ready();
    link.ready();

    link.destroy();
    channel.port2.close();
  });
});

describe('Destroy', () => {
  test('destroy rejects pending calls', async () => {
    const channel = new MessageChannel();
    const bDef = defineLink({
      procedures: {
        forever: () => new Promise(() => {}),
      },
    });

    const [main, worker] = [new MsgLink(channel.port1), new MsgLink(channel.port2, bDef)];

    const p = main.call('forever');
    main.destroy();
    await expect(p).rejects.toThrow('MsgLink destroyed');

    worker.destroy();
  });

  test('destroy rejects waitForReady', async () => {
    const channel = new MessageChannel();
    const main = new MsgLink(channel.port1, { waitReady: true });

    const p = main.waitForReady();
    main.destroy();
    await expect(p).rejects.toThrow('MsgLink destroyed');

    channel.port2.close();
  });

  test('destroy rejects queued calls', async () => {
    const channel = new MessageChannel();
    const main = new MsgLink(channel.port1, { waitReady: true });

    // These calls are queued since not ready
    const p1 = main.call('anything');
    const p2 = main.call('something');

    main.destroy();

    await expect(p1).rejects.toThrow('MsgLink destroyed');
    await expect(p2).rejects.toThrow('MsgLink destroyed');

    channel.port2.close();
  });

  test('.destroy() is idempotent', () => {
    const channel = new MessageChannel();
    const link = new MsgLink(channel.port1);

    // Should not throw on second call
    link.destroy();
    link.destroy();

    channel.port2.close();
  });

  test('ready after destroy throws', () => {
    const channel = new MessageChannel();
    const link = new MsgLink(channel.port1);
    link.destroy();
    expect(() => link.ready()).toThrow('MsgLink destroyed');

    channel.port2.close();
  });
});
