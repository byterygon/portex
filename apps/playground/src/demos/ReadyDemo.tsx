import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink, defineLink } from '@byterygon/portex';

export function ReadyDemo() {
  return (
    <TestSection
      id="ready"
      title="Ready Handshake"
      description="waitReady queuing, .ready(), .waitForReady()"
    >
      <TestCase
        name="Queue and flush — waitReady: true"
        run={async (log) => {
          const channel = new MessageChannel();
          const workerDef = defineLink({
            procedures: {
              double: (n: number, _ctx) => n * 2,
            },
          });
          const main = new MsgLink(channel.port1, { waitReady: true });
          const worker = new MsgLink(channel.port2, workerDef);
          log('Main created with waitReady: true');
          log('Queuing call double(21) before ready...');
          const promise = main.call('double', 21);
          log('Signaling ready from worker side');
          worker.ready();
          const result = await promise;
          log(`Result: ${result}`);
          if (result !== 42) throw new Error(`Expected 42, got ${result}`);
          main.destroy();
          worker.destroy();
        }}
      />
      <TestCase
        name="waitForReady() resolves on ready signal"
        run={async (log) => {
          const channel = new MessageChannel();
          const main = new MsgLink(channel.port1, { waitReady: true });
          const worker = new MsgLink(channel.port2);
          let resolved = false;
          log('Calling waitForReady()...');
          const p = main.waitForReady().then(() => {
            resolved = true;
          });
          log(`Resolved before ready? ${resolved}`);
          if (resolved) throw new Error('Should not be resolved yet');
          worker.ready();
          await p;
          log(`Resolved after ready? ${resolved}`);
          if (!resolved) throw new Error('Should be resolved');
          main.destroy();
          worker.destroy();
        }}
      />
      <TestCase
        name="Already ready — waitForReady() resolves immediately"
        run={async (log) => {
          const channel = new MessageChannel();
          const main = new MsgLink(channel.port1); // waitReady: false (default)
          log('Created link without waitReady (default: false)');
          await main.waitForReady();
          log('waitForReady() resolved immediately');
          main.destroy();
          channel.port2.close();
        }}
      />
    </TestSection>
  );
}
