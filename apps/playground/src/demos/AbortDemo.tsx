import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink, defineLink } from '@byterygon/portex';
import type { ProcedureContext } from '@byterygon/portex';

const bDef = defineLink({
  procedures: {
    slow: async (ctx: ProcedureContext) => {
      await new Promise<void>((_, reject) => {
        ctx.signal.addEventListener('abort', () => reject(new Error('aborted')));
        setTimeout(() => reject(new Error('timeout')), 10000);
      });
    },
  },
});

export function AbortDemo() {
  return (
    <TestSection id="abort" title="Abort" description="AbortController cancellation">
      <TestCase
        name="Abort mid-call"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          const controller = new AbortController();
          log('Starting slow call...');
          const promise = a.call('slow', { signal: controller.signal });
          log('Aborting after 100ms...');
          setTimeout(() => controller.abort(), 100);
          try {
            await promise;
            throw new Error('Should have rejected');
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              log(`Got AbortError: ${err.message}`);
            } else {
              throw err;
            }
          }
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Pre-aborted signal → immediate rejection"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          const signal = AbortSignal.abort();
          log('Calling with pre-aborted signal...');
          try {
            await a.call('slow', { signal });
            throw new Error('Should have rejected');
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              log(`Got immediate AbortError: ${err.message}`);
            } else {
              throw err;
            }
          }
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Timeout abort — AbortSignal.timeout(500)"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          const signal = AbortSignal.timeout(500);
          log('Calling with 500ms timeout...');
          const start = Date.now();
          try {
            await a.call('slow', { signal });
            throw new Error('Should have rejected');
          } catch (err) {
            const elapsed = Date.now() - start;
            if (err instanceof DOMException) {
              log(`Got ${err.name} after ${elapsed}ms: ${err.message}`);
            } else {
              throw err;
            }
          }
          a.destroy();
          b.destroy();
        }}
      />
    </TestSection>
  );
}
