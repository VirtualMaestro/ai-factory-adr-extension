import { adrRoot } from './config/paths.js';
import { read } from './artifacts/frontmatter.js';
import { listAdrs } from './status.js';
import { STATUS_BY_DIR } from './lifecycle/status.js';

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Cycles among the unscheduled (`remaining`) nodes, via Tarjan's SCC over the depends_on subgraph.
 * A component is a cycle if it has >1 node, or a single node depending on itself. Using SCCs (not a
 * back-edge DFS) keeps every member of overlapping/nested cycles — a plain DFS drops them. Each
 * returned cycle is sorted by id for deterministic output.
 */
function findCycles(ids, index, remaining) {
  let counter = 0;
  const idx = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];
  const connect = (v) => {
    idx.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of index.get(v).deps) {
      if (!remaining.has(w)) continue; // only edges inside the unscheduled subgraph
      if (!idx.has(w)) {
        connect(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v), idx.get(w)));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      sccs.push(comp);
    }
  };
  for (const v of ids) if (!idx.has(v)) connect(v);
  return sccs
    .filter((c) => c.length > 1 || index.get(c[0]).deps.includes(c[0]))
    .map((c) => c.sort());
}

/**
 * Dependency-ordered implementation plan over `depends_on` (§23 retrieval order is separate).
 * Pure/deterministic; Markdown-in-Git is the only input. Cycle *validation* remains `audit-artifacts`'
 * job — this surfaces cycles only to explain why a full order can't be produced.
 *
 * Returns { next, order, blocked, cycles, active }:
 *   next    — ready-now ids: status=accepted AND every dep already active (the "start here" list)
 *   order   — [{ id, status, ready, blockedBy, wave }] topological order of the schedulable backlog
 *   blocked — [{ id, status, blockedBy, note? }] nodes no order can reach (superseded dep, or behind a cycle)
 *   cycles  — [[id,…]] dependency cycles
 *   active  — already-implemented ids (context)
 */
export async function buildOrder({ projectDir = process.cwd() } = {}) {
  const root = await adrRoot(projectDir);
  const nodes = [];
  for (const { dir, file } of await listAdrs(root)) {
    let data;
    try {
      ({ data } = await read(file));
    } catch {
      continue; // malformed ADRs are reported by status --check / audit-artifacts
    }
    if (data.id == null) continue;
    nodes.push({ id: data.id, status: STATUS_BY_DIR[dir], deps: asArray(data.depends_on).map(String) });
  }
  const index = new Map(nodes.map((n) => [n.id, n]));

  // A dep is satisfied only when it resolves to a known ADR that is already active. An unknown/missing
  // id blocks: "all deps active" cannot hold for a dependency that doesn't exist (audit flags the
  // dangling ref separately).
  const unsatisfied = (n) => n.deps.filter((d) => index.get(d)?.status !== 'active');

  const active = nodes.filter((n) => n.status === 'active').map((n) => n.id).sort();
  const orderNodes = nodes.filter((n) => n.status !== 'active' && n.status !== 'superseded');

  // ponytail: Kahn-style wave scheduling, fixpoint over the in-repo ADR set; no external graph lib.
  const scheduled = new Set();
  const remaining = new Set(orderNodes.map((n) => n.id));
  const order = [];
  for (let wave = 0; ; wave++) {
    const front = [...remaining]
      .map((id) => index.get(id))
      .filter((n) => n.deps.every((d) => {
        const t = index.get(d);
        return (t && t.status === 'active') || scheduled.has(d); // resolved+active | already scheduled
      }))
      .sort(byId);
    if (!front.length) break;
    for (const n of front) {
      const blockedBy = unsatisfied(n);
      order.push({ id: n.id, status: n.status, ready: blockedBy.length === 0, blockedBy, wave });
      scheduled.add(n.id);
      remaining.delete(n.id);
    }
  }

  const leftover = [...remaining];
  const cycles = findCycles(leftover, index, remaining);
  const cyclic = new Set(cycles.flat());
  const blocked = leftover
    .filter((id) => !cyclic.has(id))
    .map((id) => {
      const n = index.get(id);
      const unknown = n.deps.filter((d) => !index.has(d));
      const sup = n.deps.filter((d) => index.get(d)?.status === 'superseded');
      const notes = [];
      if (unknown.length) notes.push(`unknown dependency ${unknown.join(', ')}`);
      if (sup.length) notes.push(`depends on superseded ${sup.join(', ')} — repoint to its replacement`);
      return { id, status: n.status, blockedBy: unsatisfied(n), ...(notes.length ? { note: notes.join('; ') } : {}) };
    })
    .sort(byId);

  const next = order.filter((o) => o.ready && o.status === 'accepted').map((o) => o.id);

  return { next, order, blocked, cycles, active };
}
