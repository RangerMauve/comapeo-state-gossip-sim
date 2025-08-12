function noop() {}

export class Sim {
  // Map<id, known>
  #nodes = new Map();
  #onNew = noop;
  #onEdgeChange = noop;

  constructor({ onNew = noop, onEdgeChange = noop } = {}) {
    this.#onNew = onNew;
    this.#onEdgeChange = onEdgeChange;
  }

  spawnMany(count = 16) {
    return new Array(count).fill(null).map(() => this.spawn());
  }

  spawn() {
    const id = this.size;
    const node = new Node(id, randomInt(1, 64));
    this.#nodes.set(id, node);
    this.#onNew(node);
    return node;
  }

  node(id) {
    return this.#nodes.get(id);
  }

  get nodes() {
    return this.#nodes.values();
  }

  randomNode() {
    const id = randomInt(0, this.size - 1);
    return this.node(id);
  }

  get size() {
    return this.#nodes.size;
  }

  knowsLatestOf(knowerNodeId, syncNodeId) {
    const knower = this.node(knowerNodeId);
    const syncNode = this.node(syncNodeId);
    const known = knower.lengthFor(syncNodeId);
    return known === syncNode.length;
  }

  syncRandom() {
    // Two random peers
    const a = this.randomNode();
    const b = this.randomNode();

    // Gossip others states
    a.receiveGossipedStates(b.othersStates());
    b.receiveGossipedStates(a.othersStates());

    a.sync(b);
    b.sync(a);

    // both a and b have the same state now
    a.onSyncComplete(b.id);
    b.onSyncComplete(a.id);
  }

  incrementRandom() {
    this.randomNode().incrementLength();
  }
}

class Node {
  #id = 0;
  // Map<id, length>
  #ownState = new Map();
  // Map<id, Map<id, length>
  #othersStates = new Map();

  constructor(id, initialLength = 0) {
    this.#id = id;
    this.#ownState.set(id, initialLength);
  }

  get length() {
    return this.#ownState.get(this.#id) ?? 0;
  }

  get id() {
    return this.#id;
  }

  ownState() {
    return structuredClone(this.#ownState);
  }

  othersStates() {
    return structuredClone(this.#othersStates);
  }

  othersState(id) {
    return structuredClone(this.#othersStates.get(id));
  }

  // pull-syncs with node (updates lengths to lengths from node)
  sync(otherNode) {
    for (const [nodeId, length] of otherNode.ownState()) {
      const currentLength = this.#ownState.get(nodeId) ?? 0;
      this.#ownState.set(nodeId, Math.max(currentLength, length));
    }
  }

  onSyncComplete(nodeId) {
    // node has same sync state as this node
    this.#othersStates.set(nodeId, structuredClone(this.#ownState));
  }

  receiveGossipedStates(othersStates) {
    for (const [otherNodeId, otherNodeState] of othersStates) {
      if (otherNodeId === this.#id) continue; // skip self
      const currentOtherStateKnowledge =
        this.#othersStates.get(otherNodeId) ?? new Map();
      for (const [nodeId, length] of otherNodeState) {
        const currentLength = currentOtherStateKnowledge.get(nodeId) ?? 0;
        currentOtherStateKnowledge.set(nodeId, Math.max(currentLength, length));
      }
      this.#othersStates.set(otherNodeId, currentOtherStateKnowledge);
    }
  }

  incrementLength(count = 1) {
    const currentLength = this.#ownState.get(this.#id) ?? 0;
    this.#ownState.set(this.#id, currentLength + count);
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
