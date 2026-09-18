import type { ContentDB, NodeDef } from '../types/content';
import type { CharacterState } from '../types/state';
import { evalCondition, type ConditionContext } from './conditions';

export type NodeAvailability =
  | { ok: true }
  | { ok: false; reason: 'owned' | 'points' | 'requires' | 'excluded' | 'condition' | 'era'; detail?: string };

export function nodesFor(content: ContentDB, character: string): NodeDef[] {
  return Object.values(content.nodes)
    .filter((n) => n.character === character)
    .sort((a, b) => a.col - b.col || a.row - b.row);
}

export function nodeAvailability(content: ContentDB, node: NodeDef, cs: CharacterState, ctx: ConditionContext): NodeAvailability {
  if (cs.nodes.includes(node.id)) return { ok: false, reason: 'owned' };
  for (const owned of cs.nodes) {
    const o = content.nodes[owned];
    if (o?.excludes.includes(node.id) || node.excludes.includes(owned)) {
      return { ok: false, reason: 'excluded', detail: o?.name ?? owned };
    }
  }
  const missing = node.requires.filter((r) => !cs.nodes.includes(r));
  if (missing.length) return { ok: false, reason: 'requires', detail: missing.map((m) => content.nodes[m]?.name ?? m).join(', ') };
  if (node.type === 'condition' && node.condition && !evalCondition(node.condition, ctx)) {
    return { ok: false, reason: 'condition', detail: node.conditionHint };
  }
  if (node.type === 'era' && node.era && node.era !== ctx.era) return { ok: false, reason: 'era', detail: node.era };
  if (cs.skillPoints < node.cost) return { ok: false, reason: 'points', detail: `${node.cost}` };
  return { ok: true };
}

export function unlockNode(content: ContentDB, cs: CharacterState, nodeId: string, ctx: ConditionContext): CharacterState {
  const node = content.nodes[nodeId];
  if (!node) throw new Error(`Unknown node ${nodeId}`);
  if (node.character !== cs.id) throw new Error(`Node ${nodeId} belongs to ${node.character}`);
  const a = nodeAvailability(content, node, cs, ctx);
  if (!a.ok) throw new Error(`Cannot unlock ${nodeId}: ${a.reason}`);
  return { ...cs, nodes: [...cs.nodes, nodeId], skillPoints: cs.skillPoints - node.cost };
}
