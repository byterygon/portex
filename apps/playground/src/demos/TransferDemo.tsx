import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink, defineLink } from '@byterygon/portex';
import type { ProcedureContext } from '@byterygon/portex';

export function TransferDemo() {
  return (
    <TestSection
      id="transfer"
      title="Transfer"
      description="Transferable objects (ArrayBuffer) ownership transfer via MessagePort"
    >
      <TestCase
        name="Transfer ArrayBuffer — sender neutered"
        run={async (log) => {
          const bDef = defineLink({
            procedures: {
              receiveBuffer: (buf: ArrayBuffer, _ctx: ProcedureContext) => {
                return buf.byteLength;
              },
            },
          });
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          const buffer = new ArrayBuffer(1024 * 1024); // 1MB
          log(`Sender buffer size before: ${buffer.byteLength} bytes`);
          const remoteSize = await a.call('receiveBuffer', buffer, { transfer: [buffer] });
          log(`Sender buffer size after: ${buffer.byteLength} bytes (neutered)`);
          log(`Remote received: ${remoteSize} bytes`);
          if (buffer.byteLength !== 0) throw new Error('Buffer should be neutered');
          if (remoteSize !== 1024 * 1024) throw new Error('Remote should receive 1MB');
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Transfer in progress — ctx.progress(data, [buffer])"
        run={async (log) => {
          const bDef = defineLink({
            procedures: {
              sendChunks: async (ctx: ProcedureContext) => {
                for (let i = 0; i < 3; i++) {
                  const chunk = new ArrayBuffer(256);
                  new Uint8Array(chunk).fill(i + 1);
                  ctx.progress({ index: i, size: chunk.byteLength }, [chunk]);
                  await new Promise((r) => setTimeout(r, 100));
                }
                return 'all chunks sent';
              },
            },
          });
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          const received: unknown[] = [];
          const result = await a.call('sendChunks', {
            onProgress: (d: unknown) => {
              received.push(d);
              log(`Progress chunk: ${JSON.stringify(d)}`, 'progress');
            },
          });
          log(`Result: '${result}', received ${received.length} chunks`);
          if (received.length !== 3) throw new Error(`Expected 3 chunks, got ${received.length}`);
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Transfer in response — ctx.transfer([buffer])"
        run={async (log) => {
          const bDef = defineLink({
            procedures: {
              makeBuffer: (_ctx: ProcedureContext) => {
                const buf = new ArrayBuffer(512);
                new Uint8Array(buf).fill(42);
                _ctx.transfer([buf]);
                return buf;
              },
            },
          });
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          log('Calling makeBuffer()...');
          const result = (await a.call('makeBuffer')) as ArrayBuffer;
          log(`Received buffer: ${result.byteLength} bytes`);
          const view = new Uint8Array(result);
          log(`First byte: ${view[0]} (expected 42)`);
          if (result.byteLength !== 512) throw new Error('Expected 512 bytes');
          if (view[0] !== 42) throw new Error('Expected byte value 42');
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Transfer MessagePort — nested channel"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2);

          // Create a second channel, transfer one port to the other side
          const nested = new MessageChannel();
          log('Created nested MessageChannel');
          log('Transferring nested.port2 to side B...');

          b.on('newPort', (payload: unknown) => {
            const port = payload as MessagePort;
            const nestedB = new MsgLink(port);
            nestedB.procedure('hello', (_ctx: unknown) => 'from nested link!');
          });

          a.emit('newPort', nested.port2, [nested.port2]);
          log('Port transferred via emit()');

          await new Promise((r) => setTimeout(r, 50));

          const nestedA = new MsgLink(nested.port1);
          const result = await nestedA.call('hello');
          log(`Nested RPC result: '${result}'`);
          if (result !== 'from nested link!') throw new Error(`Unexpected: ${result}`);

          nestedA.destroy();
          a.destroy();
          b.destroy();
        }}
      />
    </TestSection>
  );
}
