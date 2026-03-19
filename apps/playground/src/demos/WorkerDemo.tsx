import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink } from '@byterygon/portex';

function createWorkerLink() {
  const worker = new Worker(new URL('../worker.ts', import.meta.url), { type: 'module' });
  const link = new MsgLink(worker, { waitReady: true });
  return { link, worker };
}

export function WorkerDemo() {
  return (
    <TestSection id="worker" title="Web Worker" description="Real Web Worker transport">
      <TestCase
        name="Worker RPC — compute(10) → 100"
        run={async (log) => {
          const { link, worker } = createWorkerLink();
          log('Created worker, waiting for ready...');
          await link.waitForReady();
          log('Worker ready, calling compute(10)...');
          const result = await link.call('compute', 10);
          log(`compute(10) = ${result}`);
          if (result !== 100) throw new Error(`Expected 100, got ${result}`);
          link.destroy();
          worker.terminate();
        }}
      />
      <TestCase
        name="Worker + progress — slowCompute with progress 0→100"
        run={async (log) => {
          const { link, worker } = createWorkerLink();
          await link.waitForReady();
          log('Calling slowCompute(7) with progress...');
          const result = await link.call('slowCompute', 7, {
            onProgress: (d: unknown) => {
              const pct = d as number;
              const bar =
                '\u2588'.repeat(Math.floor(pct / 5)) + '\u2591'.repeat(20 - Math.floor(pct / 5));
              log(`[${bar}] ${pct}%`, 'progress');
            },
          });
          log(`Result: ${result}`);
          if (result !== 49) throw new Error(`Expected 49, got ${result}`);
          link.destroy();
          worker.terminate();
        }}
      />
      <TestCase
        name="Worker abort — cancel slowCompute"
        run={async (log) => {
          const { link, worker } = createWorkerLink();
          await link.waitForReady();
          const controller = new AbortController();
          log('Calling slowCompute(5), will abort after 300ms...');
          const promise = link.call('slowCompute', 5, {
            signal: controller.signal,
            onProgress: (d: unknown) => log(`Progress: ${d}%`, 'progress'),
          });
          setTimeout(() => {
            log('Aborting...');
            controller.abort();
          }, 300);
          try {
            await promise;
            throw new Error('Should have been aborted');
          } catch (err) {
            if (err instanceof DOMException && err.name === 'AbortError') {
              log(`Got AbortError: ${err.message}`);
            } else {
              throw err;
            }
          }
          link.destroy();
          worker.terminate();
        }}
      />
      <TestCase
        name="Worker events — ping/pong"
        run={async (log) => {
          const { link, worker } = createWorkerLink();
          await link.waitForReady();
          log('Subscribing to "pong" event...');
          const pongPromise = new Promise<unknown>((resolve) => {
            link.on('pong', resolve);
          });
          log('Emitting "ping" to worker...');
          link.emit('ping', { mainTime: Date.now() });
          const pong = await pongPromise;
          log(`Received pong: ${JSON.stringify(pong)}`);
          link.destroy();
          worker.terminate();
        }}
      />
      <TestCase
        name="Worker ready handshake — waitForReady()"
        run={async (log) => {
          const { link, worker } = createWorkerLink();
          log('Waiting for worker to signal ready...');
          const start = Date.now();
          await link.waitForReady();
          const elapsed = Date.now() - start;
          log(`Worker ready after ${elapsed}ms`);
          const result = await link.call('compute', 3);
          log(`compute(3) = ${result}`);
          if (result !== 9) throw new Error(`Expected 9, got ${result}`);
          link.destroy();
          worker.terminate();
        }}
      />
    </TestSection>
  );
}
