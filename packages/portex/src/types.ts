export type PortexPort = {
  postMessage(data: unknown, transfer?: Transferable[]): void;
  addEventListener(event: 'message', handler: (e: { data: unknown }) => void): void;
  removeEventListener(event: 'message', handler: (e: { data: unknown }) => void): void;
};

export type ProcedureContext<TProgress = unknown> = {
  signal: AbortSignal;
  progress: (data: TProgress, transfer?: Transferable[]) => void;
  transfer: (objects: Transferable[]) => void;
};

export type CallOptions<TProgress = unknown> = {
  signal?: AbortSignal;
  onProgress?: (data: TProgress) => void;
  transfer?: Transferable[];
};

export type MsgLinkOptions = {
  waitReady?: boolean;
};

export type ProcedureMap = Record<string, { args: unknown[]; return: unknown; progress?: unknown }>;

export type EventMap = Record<string, unknown>;

export type ResolveProgress<TDef> = TDef extends { progress: infer P } ? P : unknown;
