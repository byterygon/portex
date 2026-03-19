import { LogOutput } from './LogOutput.tsx';
import { useTestRunner } from '../hooks/useTestRunner.ts';
import type { LogFn } from '../hooks/useTestRunner.ts';

const statusIcons: Record<string, string> = {
  idle: '\u25CB',
  running: '\u25D4',
  pass: '\u25CF',
  fail: '\u25CF',
};

const statusColors: Record<string, string> = {
  idle: '#8b949e',
  running: '#58a6ff',
  pass: '#3fb950',
  fail: '#f85149',
};

type Props = {
  name: string;
  run: (log: LogFn) => Promise<void>;
};

export function TestCase({ name, run: runFn }: Props) {
  const { status, logs, run, clear } = useTestRunner();

  return (
    <div className="test-case">
      <div className="test-case-header">
        <span style={{ color: statusColors[status], marginRight: 8 }}>{statusIcons[status]}</span>
        <span className="test-case-name">{name}</span>
        <button onClick={() => run(runFn)} disabled={status === 'running'}>
          Run
        </button>
        {status !== 'idle' && (
          <button onClick={clear} className="btn-clear">
            Clear
          </button>
        )}
      </div>
      <LogOutput logs={logs} />
    </div>
  );
}
