import { useState, useCallback, useRef } from 'react';

export type LogEntry = {
  text: string;
  type: 'info' | 'success' | 'error' | 'progress';
};

export type TestStatus = 'idle' | 'running' | 'pass' | 'fail';

export type LogFn = (text: string, type?: LogEntry['type']) => void;

export function useTestRunner() {
  const [status, setStatus] = useState<TestStatus>('idle');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<LogEntry[]>([]);

  const run = useCallback((fn: (log: LogFn) => Promise<void>) => {
    logsRef.current = [];
    setLogs([]);
    setStatus('running');

    const log: LogFn = (text, type = 'info') => {
      const entry = { text, type };
      logsRef.current = [...logsRef.current, entry];
      setLogs(logsRef.current);
    };

    fn(log)
      .then(() => {
        setStatus('pass');
        log('PASSED', 'success');
      })
      .catch((err: unknown) => {
        setStatus('fail');
        log(`FAILED: ${err instanceof Error ? err.message : String(err)}`, 'error');
      });
  }, []);

  const clear = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
    setStatus('idle');
  }, []);

  return { status, logs, run, clear };
}
