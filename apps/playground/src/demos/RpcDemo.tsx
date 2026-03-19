import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink, defineLink } from '@byterygon/portex';

const bDef = defineLink({
  procedures: {
    double: (n: number, _ctx) => n * 2,
    greet: (name: string, _ctx) => `hello ${name}`,
    asyncDouble: async (n: number, _ctx) => {
      await new Promise((r) => setTimeout(r, 500));
      return n * 2;
    },
    throws: (_ctx) => {
      throw new Error('handler error');
    },
  },
});

export function RpcDemo() {
  return (
    <TestSection id="rpc" title="RPC" description="Basic remote procedure calls via MessageChannel">
      <TestCase
        name="Basic RPC — double(21) → 42"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          log('Created MessageChannel, linked port1 (caller) ↔ port2 (callee)');
          const result = await a.call('double', 21);
          log(`double(21) = ${result}`);
          if (result !== 42) throw new Error(`Expected 42, got ${result}`);
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="String argument — greet('world') → 'hello world'"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          const result = await a.call('greet', 'world');
          log(`greet('world') = '${result}'`);
          if (result !== 'hello world') throw new Error(`Expected 'hello world', got '${result}'`);
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Async handler — asyncDouble(5) with 500ms delay"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          log('Calling asyncDouble(5)... waiting 500ms');
          const start = Date.now();
          const result = await a.call('asyncDouble', 5);
          const elapsed = Date.now() - start;
          log(`asyncDouble(5) = ${result} (took ${elapsed}ms)`);
          if (result !== 10) throw new Error(`Expected 10, got ${result}`);
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Handler throws → caller receives rejection"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          log('Calling throws()...');
          try {
            await a.call('throws');
            throw new Error('Should have rejected');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`Caught error: ${msg}`);
            if (!msg.includes('handler error')) throw new Error(`Unexpected error: ${msg}`);
          }
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Unknown method → rejection"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          log('Calling nonexistent()...');
          try {
            await a.call('nonexistent');
            throw new Error('Should have rejected');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`Caught error: ${msg}`);
            if (!msg.includes('Unknown procedure')) throw new Error(`Unexpected error: ${msg}`);
          }
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Concurrent calls — 5 parallel double() calls"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          log('Firing 5 parallel calls...');
          const results = await Promise.all([
            a.call('double', 1),
            a.call('double', 2),
            a.call('double', 3),
            a.call('double', 4),
            a.call('double', 5),
          ]);
          log(`Results: [${results.join(', ')}]`);
          const expected = [2, 4, 6, 8, 10];
          for (let i = 0; i < 5; i++) {
            if (results[i] !== expected[i])
              throw new Error(`Index ${i}: expected ${expected[i]}, got ${results[i]}`);
          }
          a.destroy();
          b.destroy();
        }}
      />
    </TestSection>
  );
}
