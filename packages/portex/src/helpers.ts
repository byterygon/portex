import type { LinkDefinition } from './define.ts';
import { MsgLink } from './MsgLink.ts';

export function createPair<TBDef extends LinkDefinition = LinkDefinition>(
  bDef?: TBDef,
): [MsgLink<LinkDefinition, TBDef>, MsgLink<TBDef, LinkDefinition>] {
  const channel = new MessageChannel();
  const a = new MsgLink<LinkDefinition, TBDef>(channel.port1);
  const b = bDef
    ? new MsgLink<TBDef, LinkDefinition>(channel.port2, bDef)
    : (new MsgLink(channel.port2) as MsgLink<TBDef, LinkDefinition>);
  return [a, b];
}
