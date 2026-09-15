import { z } from 'zod';
import { parseDocument } from 'yaml';

const id = z.string().regex(/^[a-z][a-z0-9_-]{0,47}$/);
const label = z.string().min(1).max(100).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s), 'Control characters are not allowed');
export const roles = ['unspecified', 'regulator', 'inner-loop', 'command', 'limit'] as const;
const assignment = z.strictObject({ quantity: id, role: z.enum(roles).default('unspecified') });
const flow = z.enum(['forward', 'reverse', 'bidirectional', 'off']);
const endpoint = z.strictObject({ node: id, port: id.optional() });
export const InputSchema = z.strictObject({
  schemaVersion: z.literal(1),
  title: label,
  description: z.string().max(600).default(''),
  groups: z.array(z.strictObject({ id, label })).min(1).max(8),
  quantities: z.array(z.strictObject({ id, symbol: label, label, unit: label.optional(), exclusive: z.boolean().default(false) })).min(1).max(20),
  stages: z.array(z.strictObject({ id, label, technology: label.optional(), kind: z.enum(['external', 'converter', 'bus']) })).min(2).max(12),
  boundary: z.strictObject({ label, members: z.array(id).min(1) }).optional(),
  links: z.array(z.strictObject({ id, from: id, to: id, capability: z.enum(['forward', 'bidirectional']).default('bidirectional') })).min(1).max(20),
  modes: z.array(z.strictObject({
    id, label, group: id, extends: id.optional(),
    flow: z.record(id, flow).optional(),
    controls: z.record(id, z.array(assignment).max(20)).optional(),
    note: z.string().max(400).optional(),
  })).min(1).max(20),
  focusQuantity: id.optional(),
  notes: z.array(z.string().min(1).max(400)).max(12).default([]),
  signals: z.strictObject({
    title: label,
    description: z.string().max(400),
    nodes: z.array(z.strictObject({
      id, label, kind: z.enum(['reference', 'controller', 'plant', 'limiter', 'measurement']),
      detail: label.optional(),
      ports: z.array(z.strictObject({ id, side: z.enum(['WEST', 'EAST', 'NORTH', 'SOUTH']) })).max(12).default([]),
    })).min(1).max(60),
    edges: z.array(z.strictObject({ id, from: endpoint, to: endpoint, label: label.optional(), kind: z.enum(['signal', 'feedback']).default('signal') })).max(120),
  }).optional(),
});
export type Input = z.infer<typeof InputSchema>;
export type Assignment = z.infer<typeof assignment>;
export type Mode = Omit<Input['modes'][number], 'extends' | 'controls' | 'flow'> & {
  controls: Record<string, Assignment[]>;
  flow: Record<string, z.infer<typeof flow>>;
};
export type Model = Omit<Input, 'modes'> & { modes: Mode[] };

export class ModelError extends Error {
  constructor(message: string) { super(message); this.name = 'ModelError'; }
}
function ensure(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ModelError(message);
}
function unique(items: { id: string }[], name: string) {
  const seen = new Set<string>();
  for (const item of items) { ensure(!seen.has(item.id), `Duplicate ${name} id: ${item.id}`); seen.add(item.id); }
}

/** Resolve inheritance, then check references and declared constraints. Not a control-system proof. */
export function validateModel(value: unknown): Model {
  const result = InputSchema.safeParse(value);
  if (!result.success) throw new ModelError(result.error.issues.map(i => `${i.path.join('.') || 'model'}: ${i.message}`).join('\n'));
  const input = result.data;
  for (const key of ['groups', 'quantities', 'stages', 'links', 'modes'] as const) unique(input[key], key);
  const stageIds = new Set(input.stages.map(s => s.id));
  const groupIds = new Set(input.groups.map(g => g.id));
  const quantityIds = new Set(input.quantities.map(q => q.id));
  const linkIds = new Set(input.links.map(l => l.id));
  // V1 presentation intentionally models a serial power-conversion path.
  ensure(input.links.length === input.stages.length - 1, 'Power path must have exactly one link between each adjacent stage. Use signals for general graphs.');
  input.links.forEach((link, i) => {
    ensure(link.from === input.stages[i].id && link.to === input.stages[i + 1].id, `links.${link.id}: from/to must follow stages order`);
  });
  if (input.boundary) {
    const indexes = input.boundary.members.map(s => { ensure(stageIds.has(s), `Unknown boundary stage: ${s}`); return input.stages.findIndex(x => x.id === s); }).sort((a, b) => a - b);
    ensure(new Set(indexes).size === indexes.length, 'Duplicate boundary member');
    ensure(indexes.every((n, i) => n === indexes[0] + i), 'Boundary members must be contiguous in the power path');
  }
  if (input.focusQuantity) ensure(quantityIds.has(input.focusQuantity), `Unknown focus quantity: ${input.focusQuantity}`);
  const raw = new Map(input.modes.map(m => [m.id, m]));
  const resolved = new Map<string, Mode>();
  const visiting = new Set<string>();
  function resolve(modeId: string): Mode {
    const cached = resolved.get(modeId); if (cached) return cached;
    ensure(!visiting.has(modeId), `Inheritance cycle at mode: ${modeId}`);
    const mode = raw.get(modeId); ensure(mode, `Unknown parent mode: ${modeId}`);
    ensure(groupIds.has(mode.group), `Unknown group ${mode.group} in ${mode.id}`);
    visiting.add(modeId);
    const parent = mode.extends ? resolve(mode.extends) : undefined;
    // A child replaces the entire list for an explicitly mentioned stage. [] deliberately clears it.
    const controls = structuredClone({ ...parent?.controls, ...mode.controls });
    const flows = { ...parent?.flow, ...mode.flow };
    for (const key of Object.keys(flows)) ensure(linkIds.has(key), `Unknown power link ${key} in ${modeId}`);
    for (const link of input.links) {
      ensure(flows[link.id], `Missing flow for ${link.id} in ${modeId}`);
      ensure(link.capability === 'bidirectional' || !['reverse', 'bidirectional'].includes(flows[link.id]), `${modeId} requests reverse flow on unidirectional ${link.id}`);
    }
    for (const [stage, assignments] of Object.entries(controls)) {
      ensure(stageIds.has(stage), `Unknown control stage ${stage} in ${modeId}`);
      ensure(input.stages.find(s => s.id === stage)?.kind === 'converter', `Controls must belong to converter stages: ${stage}`);
      const seen = new Set<string>();
      for (const a of assignments) {
        ensure(quantityIds.has(a.quantity), `Unknown quantity ${a.quantity} in ${modeId}`);
        ensure(!seen.has(a.quantity), `Duplicate assignment ${a.quantity} on ${stage} in ${modeId}`); seen.add(a.quantity);
      }
    }
    for (const q of input.quantities.filter(q => q.exclusive)) {
      const owners = Object.values(controls).flat().filter(a => a.quantity === q.id && a.role === 'regulator');
      ensure(owners.length <= 1, `Multiple exclusive regulators for ${q.id} in ${modeId}`);
    }
    const output: Mode = { id: mode.id, label: mode.label, group: mode.group, controls, flow: flows, note: mode.note ?? parent?.note };
    visiting.delete(modeId); resolved.set(modeId, output); return output;
  }
  const modes = input.modes.map(m => resolve(m.id));
  if (input.signals) {
    const { nodes, edges } = input.signals;
    unique(nodes, 'signal node'); unique(edges, 'signal edge');
    nodes.forEach(n => unique(n.ports, `port in ${n.id}`));
    for (const edge of edges) for (const end of [edge.from, edge.to]) {
      const node = nodes.find(n => n.id === end.node);
      ensure(node, `Unknown signal node ${end.node}`);
      if (end.port) ensure(node.ports.some(p => p.id === end.port), `Unknown port ${end.node}.${end.port}`);
    }
  }
  return { ...input, modes };
}
export function parseModel(source: string): Model {
  ensure(new TextEncoder().encode(source).length <= 131072, 'Model is larger than 128 KiB');
  const document = parseDocument(source, { uniqueKeys: true, strict: true });
  if (document.errors.length) throw new ModelError(document.errors.map(e => e.message).join('\n'));
  if (document.warnings.length) throw new ModelError(document.warnings.map(e => e.message).join('\n'));
  return validateModel(document.toJS({ maxAliasCount: 50 }));
}
export function owners(model: Model, mode: Mode, quantity: string): string[] {
  return model.stages.filter(s => mode.controls[s.id]?.some(a => a.quantity === quantity)).map(s => s.label);
}
export function jsonSchema() { return z.toJSONSchema(InputSchema, { target: 'draft-7' }); }
