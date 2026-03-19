import { RpcDemo } from './demos/RpcDemo.tsx';
import { AbortDemo } from './demos/AbortDemo.tsx';
import { ProgressDemo } from './demos/ProgressDemo.tsx';
import { EventsDemo } from './demos/EventsDemo.tsx';
import { ReadyDemo } from './demos/ReadyDemo.tsx';
import { DestroyDemo } from './demos/DestroyDemo.tsx';
import { TransferDemo } from './demos/TransferDemo.tsx';
import { WorkerDemo } from './demos/WorkerDemo.tsx';
import { BroadcastDemo } from './demos/BroadcastDemo.tsx';
import './App.css';

const sections = [
  { id: 'rpc', label: 'RPC' },
  { id: 'abort', label: 'Abort' },
  { id: 'progress', label: 'Progress' },
  { id: 'events', label: 'Events' },
  { id: 'ready', label: 'Ready' },
  { id: 'destroy', label: 'Destroy' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'worker', label: 'Worker' },
  { id: 'broadcast', label: 'Broadcast' },
];

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>@byterygon/portex — Playground</h1>
        <p className="subtitle">Manual test & development — 36 test cases</p>
        <nav className="nav">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`}>
              {s.label}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <RpcDemo />
        <AbortDemo />
        <ProgressDemo />
        <EventsDemo />
        <ReadyDemo />
        <DestroyDemo />
        <TransferDemo />
        <WorkerDemo />
        <BroadcastDemo />
      </main>
    </div>
  );
}
