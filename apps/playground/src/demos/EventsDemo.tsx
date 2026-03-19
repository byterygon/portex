import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink } from '@byterygon/portex';

export function EventsDemo() {
  return (
    <TestSection id="events" title="Events" description="Fire-and-forget event system">
      <TestCase
        name="Emit + on — basic flow"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2);
          const received: unknown[] = [];
          a.on('ping', (payload) => received.push(payload));
          log('Side A subscribed to "ping"');
          b.emit('ping', { ts: 123 });
          log('Side B emitted "ping" with { ts: 123 }');
          await new Promise((r) => setTimeout(r, 50));
          log(`Side A received: ${JSON.stringify(received[0])}`);
          if (received.length !== 1) throw new Error(`Expected 1 event, got ${received.length}`);
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Multiple handlers — 2 handlers same event"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2);
          const r1: unknown[] = [];
          const r2: unknown[] = [];
          a.on('data', (p) => r1.push(p));
          a.on('data', (p) => r2.push(p));
          log('Registered 2 handlers on "data"');
          b.emit('data', 'hello');
          await new Promise((r) => setTimeout(r, 50));
          log(`Handler 1 received: ${r1.length} event(s)`);
          log(`Handler 2 received: ${r2.length} event(s)`);
          if (r1.length !== 1 || r2.length !== 1)
            throw new Error('Both handlers should have received 1 event');
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Unsubscribe with .off()"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2);
          const received: unknown[] = [];
          const handler = (p: unknown) => received.push(p);
          a.on('test', handler);
          log('Subscribed handler');
          a.off('test', handler);
          log('Unsubscribed with .off()');
          b.emit('test', 'should-not-arrive');
          await new Promise((r) => setTimeout(r, 50));
          log(`Received events: ${received.length}`);
          if (received.length !== 0) throw new Error('Handler should not have received events');
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Unsubscribe with return function"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2);
          const received: unknown[] = [];
          const unsub = a.on('test', (p) => received.push(p));
          log('Subscribed handler');
          unsub();
          log('Unsubscribed with returned function');
          b.emit('test', 'should-not-arrive');
          await new Promise((r) => setTimeout(r, 50));
          log(`Received events: ${received.length}`);
          if (received.length !== 0) throw new Error('Handler should not have received events');
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Bidirectional events"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2);
          const fromA: unknown[] = [];
          const fromB: unknown[] = [];
          b.on('fromA', (p) => fromA.push(p));
          a.on('fromB', (p) => fromB.push(p));
          a.emit('fromA', 'hello from A');
          b.emit('fromB', 'hello from B');
          await new Promise((r) => setTimeout(r, 50));
          log(`B received from A: '${fromA[0]}'`);
          log(`A received from B: '${fromB[0]}'`);
          if (fromA[0] !== 'hello from A' || fromB[0] !== 'hello from B')
            throw new Error('Bidirectional events failed');
          a.destroy();
          b.destroy();
        }}
      />
    </TestSection>
  );
}
