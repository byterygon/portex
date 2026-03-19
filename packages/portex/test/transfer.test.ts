import { describe, test, expect, afterEach } from 'vitest';
import { createPair, defineLink } from '../src/index.ts';
import type { MsgLink, ProcedureContext } from '../src/index.ts';

describe('Transfer', () => {
  let a: MsgLink, b: MsgLink;

  afterEach(() => {
    a.destroy();
    b.destroy();
  });

  test('transfer on .call()', async () => {
    const bDef = defineLink({
      procedures: {
        echo: (buf: ArrayBuffer, _ctx: ProcedureContext) => buf.byteLength,
      },
    });

    [a, b] = createPair(bDef);

    const buf = new ArrayBuffer(8);
    const result = await a.call('echo', buf, { transfer: [buf] });
    expect(result).toBe(8);
    // After transfer, original buffer is detached (byteLength becomes 0)
    expect(buf.byteLength).toBe(0);
  });

  test('transfer on .emit()', async () => {
    [a, b] = createPair();

    let receivedSize = -1;
    b.on('data', (payload: unknown) => {
      receivedSize = (payload as ArrayBuffer).byteLength;
    });

    const buf = new ArrayBuffer(16);
    a.emit('data', buf, [buf]);

    await new Promise((r) => setTimeout(r, 50));
    expect(receivedSize).toBe(16);
    // Original buffer is detached
    expect(buf.byteLength).toBe(0);
  });

  test('transfer on ctx.progress()', async () => {
    const bDef = defineLink({
      procedures: {
        stream: async (ctx: ProcedureContext) => {
          const buf = new ArrayBuffer(32);
          ctx.progress(buf, [buf]);
          // Buffer should be detached after transfer
          expect(buf.byteLength).toBe(0);
          return 'done';
        },
      },
    });

    [a, b] = createPair(bDef);

    let progressSize = -1;
    const result = await a.call('stream', {
      onProgress: (d: unknown) => {
        progressSize = (d as ArrayBuffer).byteLength;
      },
    });

    expect(result).toBe('done');
    expect(progressSize).toBe(32);
  });

  test('transfer on ctx.transfer() (accumulated for response)', async () => {
    const bDef = defineLink({
      procedures: {
        make: (ctx: ProcedureContext) => {
          const buf = new ArrayBuffer(64);
          ctx.transfer([buf]);
          return buf;
        },
      },
    });

    [a, b] = createPair(bDef);

    const result = (await a.call('make')) as ArrayBuffer;
    expect(result.byteLength).toBe(64);
  });
});
