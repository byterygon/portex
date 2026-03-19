import type { ProcedureContext, ProcedureMap, EventMap, ResolveProgress } from './types.ts';

// Strip the last parameter (ProcedureContext) from handler args
type ExtractArgs<F> = F extends (...args: [...infer Init, ProcedureContext<infer _P>]) => unknown
  ? Init
  : F extends (...args: infer A) => unknown
    ? A
    : never;

// Extract the progress type from the ctx parameter
type ExtractProgress<F> = F extends (
  ...args: [...infer _Init, ProcedureContext<infer P>]
) => unknown
  ? P
  : unknown;

// Unwrap Promise<T> to T
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

// Infer procedure map from handler config
type InferProcedureMap<T> = {
  [K in keyof T]: T[K] extends (...args: infer _A) => infer R
    ? {
        args: ExtractArgs<T[K]>;
        return: UnwrapPromise<R>;
        progress: ExtractProgress<T[K]>;
      }
    : never;
};

// Infer event map from event handler config
type InferEventMap<T> = {
  [K in keyof T]: T[K] extends (payload: infer P) => void ? P : void;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFunction = (...args: any[]) => any;

export type LinkDefinition<
  TProcedures extends ProcedureMap = ProcedureMap,
  TEvents extends EventMap = EventMap,
> = {
  readonly procedures?: Record<string, AnyFunction>;
  readonly on?: Record<string, AnyFunction>;
  readonly __types?: { procedures: TProcedures; events: TEvents };
};

type LinkDefinitionConfig = {
  procedures?: Record<string, AnyFunction>;
  on?: Record<string, AnyFunction>;
};

export function defineLink<
  const T extends LinkDefinitionConfig,
  TProcedures extends ProcedureMap = T['procedures'] extends Record<string, AnyFunction>
    ? InferProcedureMap<T['procedures']>
    : ProcedureMap,
  TEvents extends EventMap = T['on'] extends Record<string, AnyFunction>
    ? InferEventMap<T['on']>
    : EventMap,
>(config: T): LinkDefinition<TProcedures, TEvents> {
  return config as unknown as LinkDefinition<TProcedures, TEvents>;
}

// Utility types for extracting from LinkDefinition
export type InferProcedures<T> = T extends LinkDefinition<infer P, infer _E> ? P : never;
export type InferEvents<T> = T extends LinkDefinition<infer _P, infer E> ? E : never;

// Utility types for extracting from MsgLink instances
// These use a structural check to avoid circular imports
export type InferLocalProcedures<T> = T extends { __localDef: infer L }
  ? InferProcedures<L>
  : never;
export type InferRemoteProcedures<T> = T extends { __remoteDef: infer R }
  ? InferProcedures<R>
  : never;

// Handler type utility
export type ProcedureHandler<
  TDef extends { args: unknown[]; return: unknown; progress?: unknown },
> = (
  ...args: [...TDef['args'], ProcedureContext<ResolveProgress<TDef>>]
) => TDef['return'] | Promise<TDef['return']>;
