import type { PortexPort, ProcedureContext, CallOptions, MsgLinkOptions } from './types.ts';
import type { LinkDefinition } from './define.ts';
import { isPortexMessage, genId } from './protocol.ts';
import type { PortexMessage, PortexRequest } from './protocol.ts';

type PendingCall = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  onProgress?: (data: unknown) => void;
  abortHandler?: () => void;
  signal?: AbortSignal;
};

type ActiveCall = {
  abortController: AbortController;
  settled: boolean;
  transferables: Transferable[];
};

type QueuedMessage = {
  data: unknown;
  transfer?: Transferable[];
};

export class MsgLink<
  _TLocal extends LinkDefinition = LinkDefinition,
  _TRemote extends LinkDefinition = LinkDefinition,
> {
  private _port: PortexPort;
  private _procedures = new Map<string, (...args: unknown[]) => unknown>();
  private _eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  private _pending = new Map<string, PendingCall>();
  private _active = new Map<string, ActiveCall>();
  private _queue: QueuedMessage[] | null;
  private _ready: boolean;
  private _destroyed = false;
  private _readySent = false;
  private _readyResolvers: { resolve: () => void; reject: (e: Error) => void }[] = [];
  private _messageHandler: (e: { data: unknown }) => void;

  constructor(port: PortexPort, options?: MsgLinkOptions);
  constructor(port: PortexPort, definition: LinkDefinition, options?: MsgLinkOptions);
  constructor(
    port: PortexPort,
    defOrOpts?: LinkDefinition | MsgLinkOptions,
    maybeOpts?: MsgLinkOptions,
  ) {
    this._port = port;

    // Determine if second arg is a definition or options
    let definition: LinkDefinition | undefined;
    let options: MsgLinkOptions | undefined;

    if (defOrOpts && ('procedures' in defOrOpts || 'on' in defOrOpts)) {
      definition = defOrOpts as LinkDefinition;
      options = maybeOpts;
    } else {
      options = defOrOpts as MsgLinkOptions | undefined;
    }

    // Initialize queue based on waitReady
    if (options?.waitReady) {
      this._queue = [];
      this._ready = false;
    } else {
      this._queue = null;
      this._ready = true;
    }

    // Register handlers from definition
    if (definition?.procedures) {
      for (const [name, handler] of Object.entries(definition.procedures)) {
        this._procedures.set(name, handler as (...args: unknown[]) => unknown);
      }
    }
    if (definition?.on) {
      for (const [name, handler] of Object.entries(definition.on)) {
        const set = new Set<(payload: unknown) => void>();
        set.add(handler as (payload: unknown) => void);
        this._eventHandlers.set(name, set);
      }
    }

    // Attach message listener
    this._messageHandler = (e: { data: unknown }) => {
      if (!isPortexMessage(e.data)) return;
      this._dispatch(e.data);
    };
    this._port.addEventListener('message', this._messageHandler);

    // MessagePort requires .start() when using addEventListener
    // (Worker, BroadcastChannel don't have this method)
    if ('start' in this._port) {
      (this._port as unknown as MessagePort).start();
    }
  }

  private _dispatch(msg: PortexMessage): void {
    switch (msg.type) {
      case 'request':
        this._handleRequest(msg);
        break;
      case 'response':
        this._handleResponse(msg);
        break;
      case 'progress':
        this._handleProgress(msg);
        break;
      case 'abort':
        this._handleAbort(msg);
        break;
      case 'event':
        this._handleEvent(msg);
        break;
      case 'ready':
        this._handleReady();
        break;
    }
  }

  private _handleRequest(msg: PortexRequest): void {
    const handler = this._procedures.get(msg.method);
    if (!handler) {
      this._trySend({
        __portex: true,
        type: 'response',
        id: msg.id,
        error: `Unknown procedure: ${msg.method}`,
      });
      return;
    }

    const abortController = new AbortController();
    const active: ActiveCall = { abortController, settled: false, transferables: [] };
    this._active.set(msg.id, active);

    const ctx: ProcedureContext = {
      signal: abortController.signal,
      progress: (data: unknown, transfer?: Transferable[]) => {
        if (active.settled) return;
        this._trySend({ __portex: true, type: 'progress', id: msg.id, data }, transfer);
      },
      transfer: (objects: Transferable[]) => {
        active.transferables.push(...objects);
      },
    };

    Promise.resolve()
      .then(() => handler(...msg.args, ctx))
      .then(
        (result) => {
          active.settled = true;
          this._active.delete(msg.id);
          try {
            this._trySend(
              { __portex: true, type: 'response', id: msg.id, result },
              active.transferables.length > 0 ? active.transferables : undefined,
            );
          } catch {
            // Non-serializable result — try to send error
            try {
              this._trySend({
                __portex: true,
                type: 'response',
                id: msg.id,
                error: 'Failed to serialize response',
              });
            } catch {
              // Silently drop
            }
          }
        },
        (err: unknown) => {
          active.settled = true;
          this._active.delete(msg.id);
          if (abortController.signal.aborted) {
            this._trySend({ __portex: true, type: 'response', id: msg.id, aborted: true });
          } else {
            const message = err instanceof Error ? err.message : String(err);
            this._trySend({ __portex: true, type: 'response', id: msg.id, error: message });
          }
        },
      );
  }

  private _handleResponse(msg: PortexMessage & { type: 'response' }): void {
    const pending = this._pending.get(msg.id);
    if (!pending) return; // silently ignore (normal after abort)

    this._cleanupPending(msg.id, pending);

    if ('error' in msg) {
      pending.reject(new Error((msg as { error: string }).error));
    } else if ('aborted' in msg) {
      pending.reject(new DOMException('The operation was aborted', 'AbortError'));
    } else {
      pending.resolve((msg as { result: unknown }).result);
    }
  }

  private _handleProgress(msg: { id: string; data: unknown }): void {
    const pending = this._pending.get(msg.id);
    if (!pending) return; // silently ignore
    pending.onProgress?.(msg.data);
  }

  private _handleAbort(msg: { id: string }): void {
    const active = this._active.get(msg.id);
    if (!active) return; // silently ignore
    active.abortController.abort();
  }

  private _handleEvent(msg: { name: string; payload: unknown }): void {
    const handlers = this._eventHandlers.get(msg.name);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(msg.payload);
    }
  }

  private _handleReady(): void {
    if (this._ready) return;
    this._ready = true;

    for (const resolver of this._readyResolvers) {
      resolver.resolve();
    }
    this._readyResolvers = [];

    if (this._queue) {
      const queue = this._queue;
      this._queue = null;
      for (const item of queue) {
        this._trySend(item.data, item.transfer);
      }
    }
  }

  private _send(data: unknown, transfer?: Transferable[]): void {
    if (this._queue !== null) {
      this._queue.push({ data, transfer });
      return;
    }
    this._port.postMessage(data, transfer);
  }

  private _trySend(data: unknown, transfer?: Transferable[]): void {
    try {
      this._send(data, transfer);
    } catch {
      // Swallow for fire-and-forget
    }
  }

  private _cleanupPending(id: string, pending: PendingCall): void {
    this._pending.delete(id);
    if (pending.signal && pending.abortHandler) {
      pending.signal.removeEventListener('abort', pending.abortHandler);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  procedure(name: string, handler: (...args: any[]) => any): this {
    if (this._destroyed) throw new Error('MsgLink destroyed');
    this._procedures.set(name, handler);
    return this;
  }

  call(method: string, ...rawArgs: unknown[]): Promise<unknown> {
    if (this._destroyed) return Promise.reject(new Error('MsgLink destroyed'));

    let args = rawArgs;
    let options: CallOptions | undefined;

    // Detect CallOptions as last argument
    const lastArg = rawArgs[rawArgs.length - 1];
    if (
      typeof lastArg === 'object' &&
      lastArg !== null &&
      ('signal' in lastArg || 'onProgress' in lastArg || 'transfer' in lastArg)
    ) {
      options = lastArg as CallOptions;
      args = rawArgs.slice(0, -1);
    }

    // Pre-aborted signal
    if (options?.signal?.aborted) {
      return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));
    }

    const id = genId();

    return new Promise<unknown>((resolve, reject) => {
      const pending: PendingCall = {
        resolve,
        reject,
        onProgress: options?.onProgress,
        signal: options?.signal,
      };

      // Abort listener
      if (options?.signal) {
        const abortHandler = () => {
          this._cleanupPending(id, pending);
          this._trySend({ __portex: true, type: 'abort', id });
          reject(new DOMException('The operation was aborted', 'AbortError'));
        };
        pending.abortHandler = abortHandler;
        options.signal.addEventListener('abort', abortHandler, { once: true });
      }

      this._pending.set(id, pending);

      try {
        this._send({ __portex: true, type: 'request', id, method, args }, options?.transfer);
      } catch (err) {
        this._cleanupPending(id, pending);
        reject(err);
      }
    });
  }

  emit(name: string, payload?: unknown, transfer?: Transferable[]): void {
    if (this._destroyed) throw new Error('MsgLink destroyed');
    this._trySend({ __portex: true, type: 'event', name, payload }, transfer);
  }

  on(name: string, handler: (payload: unknown) => void): () => void {
    if (this._destroyed) throw new Error('MsgLink destroyed');
    let set = this._eventHandlers.get(name);
    if (!set) {
      set = new Set();
      this._eventHandlers.set(name, set);
    }
    set.add(handler);
    return () => {
      set.delete(handler);
      if (set.size === 0) this._eventHandlers.delete(name);
    };
  }

  off(name: string, handler: (payload: unknown) => void): void {
    if (this._destroyed) throw new Error('MsgLink destroyed');
    const set = this._eventHandlers.get(name);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this._eventHandlers.delete(name);
    }
  }

  ready(): void {
    if (this._destroyed) throw new Error('MsgLink destroyed');
    if (this._readySent) return;
    this._readySent = true;
    this._trySend({ __portex: true, type: 'ready' });
  }

  waitForReady(): Promise<void> {
    if (this._destroyed) return Promise.reject(new Error('MsgLink destroyed'));
    if (this._ready) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      this._readyResolvers.push({ resolve, reject });
    });
  }

  destroy(): void {
    if (this._destroyed) return;
    this._destroyed = true;

    // Remove message listener
    this._port.removeEventListener('message', this._messageHandler);

    // Reject all pending calls
    const destroyError = new Error('MsgLink destroyed');
    for (const [id, pending] of this._pending) {
      this._cleanupPending(id, pending);
      pending.reject(destroyError);
    }
    this._pending.clear();

    // Clear queue
    this._queue = null;

    // Abort all active calls
    for (const [, active] of this._active) {
      active.settled = true;
      active.abortController.abort();
    }
    this._active.clear();

    // Reject waitForReady promises
    for (const resolver of this._readyResolvers) {
      resolver.reject(destroyError);
    }
    this._readyResolvers = [];

    // Clear handlers
    this._procedures.clear();
    this._eventHandlers.clear();
  }
}
