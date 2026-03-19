import type { LogEntry } from '../hooks/useTestRunner.ts';

const colorMap: Record<LogEntry['type'], string> = {
  info: '#c9d1d9',
  success: '#3fb950',
  error: '#f85149',
  progress: '#58a6ff',
};

export function LogOutput({ logs }: { logs: LogEntry[] }) {
  if (logs.length === 0) return null;
  return (
    <pre className="log-output">
      {logs.map((entry, i) => (
        <div key={i} style={{ color: colorMap[entry.type] }}>
          {entry.text}
        </div>
      ))}
    </pre>
  );
}
