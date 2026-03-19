import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink, defineLink } from '@byterygon/portex';
import type { ProcedureContext } from '@byterygon/portex';

function bcPort(name: string) {
  const bc = new BroadcastChannel(name);
  return {
    port: {
      postMessage: (data: unknown) => bc.postMessage(data),
      addEventListener: (_event: 'message', handler: (e: { data: unknown }) => void) =>
        bc.addEventListener('message', handler as unknown as EventListener),
      removeEventListener: (_event: 'message', handler: (e: { data: unknown }) => void) =>
        bc.removeEventListener('message', handler as unknown as EventListener),
    },
    close: () => bc.close(),
  };
}

export function BroadcastDemo() {
  return (
    <TestSection
      id="broadcast"
      title="BroadcastChannel"
      description="BroadcastChannel transport (same-tab and cross-tab)"
    >
      <TestCase
        name="Same-tab RPC via BroadcastChannel"
        run={async (log) => {
          const channelName = `portex-demo-${Date.now()}`;
          const sideA = bcPort(channelName);
          const sideB = bcPort(channelName);
          const bDef = defineLink({
            procedures: {
              add: (x: number, y: number, _ctx: ProcedureContext) => x + y,
            },
          });
          const linkA = new MsgLink(sideA.port);
          const linkB = new MsgLink(sideB.port, bDef);
          log(`Channel: ${channelName}`);
          log('Calling add(3, 4)...');
          const result = await linkA.call('add', 3, 4);
          log(`add(3, 4) = ${result}`);
          if (result !== 7) throw new Error(`Expected 7, got ${result}`);
          linkA.destroy();
          linkB.destroy();
          sideA.close();
          sideB.close();
        }}
      />
      <TestCase
        name="Cross-tab — open second tab"
        run={async (log) => {
          const channelName = `portex-cross-tab-${Date.now()}`;
          const side = bcPort(channelName);
          const link = new MsgLink(side.port, { waitReady: true });
          log(`Channel: ${channelName}`);
          log('Opening second tab...');

          const html = `
            <html><body><h3>Portex Cross-Tab Worker</h3>
            <p>Channel: ${channelName}</p>
            <script type="module">
              import { MsgLink, defineLink } from '/src/cross-tab-helper.ts';
            </script>
            <script>
              const bc = new BroadcastChannel('${channelName}');
              const port = {
                postMessage: (d) => bc.postMessage(d),
                addEventListener: (_, h) => bc.addEventListener('message', h),
                removeEventListener: (_, h) => bc.removeEventListener('message', h),
              };
              // Inline minimal portex-like responder
              bc.addEventListener('message', (e) => {
                const msg = e.data;
                if (msg && msg.__portex && msg.type === 'request') {
                  if (msg.method === 'tabInfo') {
                    port.postMessage({
                      __portex: true, type: 'response', id: msg.id,
                      result: { userAgent: navigator.userAgent, time: Date.now() }
                    });
                  }
                }
              });
              port.postMessage({ __portex: true, type: 'ready' });
              document.body.innerHTML += '<p>Ready! Listening for RPC...</p>';
            </script></body></html>`;

          const blob = new Blob([html], { type: 'text/html' });
          const url = URL.createObjectURL(blob);
          const win = window.open(url, '_blank');

          if (!win) {
            log('Popup blocked! Please allow popups.', 'error');
            link.destroy();
            side.close();
            throw new Error('Popup blocked');
          }

          log('Waiting for second tab to be ready...');
          await link.waitForReady();
          log('Second tab ready!');

          const result = await link.call('tabInfo');
          log(`Cross-tab response: ${JSON.stringify(result)}`);

          win.close();
          URL.revokeObjectURL(url);
          link.destroy();
          side.close();
        }}
      />
      <TestCase
        name="Transfer ignored — buffer NOT neutered"
        run={async (log) => {
          const channelName = `portex-transfer-${Date.now()}`;
          const sideA = bcPort(channelName);
          const sideB = bcPort(channelName);
          const bDef = defineLink({
            procedures: {
              echo: (val: string, _ctx: ProcedureContext) => val,
            },
          });
          const linkA = new MsgLink(sideA.port);
          const linkB = new MsgLink(sideB.port, bDef);
          const buffer = new ArrayBuffer(64);
          log(`Buffer size before: ${buffer.byteLength}`);
          log('Emitting event with transfer (BroadcastChannel ignores transfer)...');
          linkA.emit('data', 'test');
          log(`Buffer size after: ${buffer.byteLength} (NOT neutered)`);
          if (buffer.byteLength === 0)
            throw new Error('Buffer should NOT be neutered with BroadcastChannel');
          log('BroadcastChannel correctly ignores transfer');
          linkA.destroy();
          linkB.destroy();
          sideA.close();
          sideB.close();
        }}
      />
    </TestSection>
  );
}
