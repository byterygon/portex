/// <reference lib="webworker" />

import { MsgLink, defineLink } from '@byterygon/portex';
import type { ProcedureContext } from '@byterygon/portex';

const port = {
  postMessage: (data: unknown, transfer?: Transferable[]) =>
    self.postMessage(data, { transfer: transfer ?? [] }),
  addEventListener: (_event: 'message', handler: (e: { data: unknown }) => void) =>
    self.addEventListener('message', handler as unknown as EventListener),
  removeEventListener: (_event: 'message', handler: (e: { data: unknown }) => void) =>
    self.removeEventListener('message', handler as unknown as EventListener),
};

const def = defineLink({
  procedures: {
    compute: (n: number) => n * n,
    slowCompute: async (n: number, ctx: ProcedureContext) => {
      for (let i = 0; i <= 100; i += 20) {
        if (ctx.signal.aborted) throw new Error('aborted');
        ctx.progress(i);
        await new Promise((r) => setTimeout(r, 200));
      }
      return n * n;
    },
  },
});

const link = new MsgLink(port, def);

link.on('ping', (payload) => {
  link.emit('pong', { original: payload, workerTime: Date.now() });
});

link.ready();
