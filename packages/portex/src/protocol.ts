export type PortexRequest = {
  __portex: true;
  type: 'request';
  id: string;
  method: string;
  args: unknown[];
};

export type PortexResponseSuccess = {
  __portex: true;
  type: 'response';
  id: string;
  result: unknown;
};

export type PortexResponseError = {
  __portex: true;
  type: 'response';
  id: string;
  error: string;
};

export type PortexResponseAborted = {
  __portex: true;
  type: 'response';
  id: string;
  aborted: true;
};

export type PortexResponse = PortexResponseSuccess | PortexResponseError | PortexResponseAborted;

export type PortexProgress = {
  __portex: true;
  type: 'progress';
  id: string;
  data: unknown;
};

export type PortexAbort = {
  __portex: true;
  type: 'abort';
  id: string;
};

export type PortexEvent = {
  __portex: true;
  type: 'event';
  name: string;
  payload: unknown;
};

export type PortexReady = {
  __portex: true;
  type: 'ready';
};

export type PortexMessage =
  | PortexRequest
  | PortexResponse
  | PortexProgress
  | PortexAbort
  | PortexEvent
  | PortexReady;

export function isPortexMessage(data: unknown): data is PortexMessage {
  return (
    typeof data === 'object' &&
    data !== null &&
    '__portex' in data &&
    (data as Record<string, unknown>).__portex === true
  );
}

let counter = 0;
export function genId(): string {
  return `${Date.now()}-${++counter}`;
}
