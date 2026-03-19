import { TestSection } from '../components/TestSection.tsx';
import { TestCase } from '../components/TestCase.tsx';
import { MsgLink, defineLink } from '@byterygon/portex';
import type { ProcedureContext } from '@byterygon/portex';

const bDef = defineLink({
  procedures: {
    countUp: async (ctx: ProcedureContext) => {
      for (let i = 1; i <= 5; i++) {
        ctx.progress(i);
        await new Promise((r) => setTimeout(r, 200));
      }
      return 'done';
    },
    percentage: async (ctx: ProcedureContext) => {
      for (let pct = 0; pct <= 100; pct += 20) {
        ctx.progress(pct);
        await new Promise((r) => setTimeout(r, 150));
      }
      return 'complete';
    },
  },
});

export function ProgressDemo() {
  return (
    <TestSection id="progress" title="Progress" description="ctx.progress() feedback callbacks">
      <TestCase
        name="Progress callbacks — countUp 1→5"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          const received: number[] = [];
          log('Calling countUp with onProgress...');
          const result = await a.call('countUp', {
            onProgress: (d: unknown) => {
              received.push(d as number);
              log(`Progress: ${d}`, 'progress');
            },
          });
          log(`Result: '${result}', progress values: [${received.join(', ')}]`);
          if (received.length !== 5) throw new Error(`Expected 5 progress, got ${received.length}`);
          if (result !== 'done') throw new Error(`Expected 'done', got '${result}'`);
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="Progress bar — percentage 0→100%"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          log('Calling percentage with onProgress...');
          const result = await a.call('percentage', {
            onProgress: (d: unknown) => {
              const pct = d as number;
              const bar =
                '\u2588'.repeat(Math.floor(pct / 5)) + '\u2591'.repeat(20 - Math.floor(pct / 5));
              log(`[${bar}] ${pct}%`, 'progress');
            },
          });
          log(`Result: '${result}'`);
          if (result !== 'complete') throw new Error(`Expected 'complete', got '${result}'`);
          a.destroy();
          b.destroy();
        }}
      />
      <TestCase
        name="No onProgress — silently ignored"
        run={async (log) => {
          const { port1, port2 } = new MessageChannel();
          const a = new MsgLink(port1);
          const b = new MsgLink(port2, bDef);
          log('Calling countUp WITHOUT onProgress...');
          const result = await a.call('countUp');
          log(`Result: '${result}' (no crash)`);
          if (result !== 'done') throw new Error(`Expected 'done', got '${result}'`);
          a.destroy();
          b.destroy();
        }}
      />
    </TestSection>
  );
}
