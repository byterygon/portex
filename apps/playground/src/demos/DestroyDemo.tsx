import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink, defineLink } from '@byterygon/portex';

export function DestroyDemo() {
  return (
    <TestSection id="destroy" title="Destroy" description="Lifecycle cleanup and destroy behavior">
      <TestCase
        name="Destroy rejects pending calls"
        run={async (log) => {
          const channel = new MessageChannel();
          const bDef = defineLink({
            procedures: {
              forever: () => new Promise(() => {}),
            },
          });
          const main = new MsgLink(channel.port1);
          const worker = new MsgLink(channel.port2, bDef);
          log('Starting forever-pending call...');
          const p = main.call('forever');
          log('Destroying main link...');
          main.destroy();
          try {
            await p;
            throw new Error('Should have rejected');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`Caught: ${msg}`);
            if (!msg.includes('destroyed')) throw new Error(`Unexpected: ${msg}`);
          }
          worker.destroy();
        }}
      />
      <TestCase
        name="Destroy is idempotent"
        run={async (log) => {
          const channel = new MessageChannel();
          const link = new MsgLink(channel.port1);
          log('Calling destroy() first time...');
          link.destroy();
          log('Calling destroy() second time...');
          link.destroy();
          log('No error on double destroy');
          channel.port2.close();
        }}
      />
      <TestCase
        name="Call after destroy → rejection"
        run={async (log) => {
          const channel = new MessageChannel();
          const link = new MsgLink(channel.port1);
          link.destroy();
          log('Link destroyed, calling .call()...');
          try {
            await link.call('anything');
            throw new Error('Should have rejected');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`Caught: ${msg}`);
            if (!msg.includes('destroyed')) throw new Error(`Unexpected: ${msg}`);
          }
          channel.port2.close();
        }}
      />
      <TestCase
        name="Emit after destroy → throws"
        run={async (log) => {
          const channel = new MessageChannel();
          const link = new MsgLink(channel.port1);
          link.destroy();
          log('Link destroyed, calling .emit()...');
          try {
            link.emit('test', { data: 1 });
            throw new Error('Should have thrown');
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            log(`Caught: ${msg}`);
            if (!msg.includes('destroyed')) throw new Error(`Unexpected: ${msg}`);
          }
          channel.port2.close();
        }}
      />
    </TestSection>
  );
}
