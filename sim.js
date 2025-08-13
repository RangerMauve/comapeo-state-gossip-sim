function noop () {}

export class Sim {
  // Map<id, known>
  #nodes = new Map()
  #onNew = noop
  #onEdgeChange = noop

  constructor ({ onNew = noop, onEdgeChange = noop } = {}) {
    this.#onNew = onNew
    this.#onEdgeChange = onEdgeChange
  }

  spawnMany (count = 16) {
    return new Array(count).fill(null).map(() => this.spawn())
  }

  spawn () {
    const id = this.size
    const node = new Node(id, randomInt(1, 64))
    this.#nodes.set(id, node)
    this.#onNew(node)
    return node
  }

  node (id) {
    return this.#nodes.get(id)
  }

  get nodes () {
    return this.#nodes.values()
  }

  randomNode () {
    const id = randomInt(0, this.size - 1)
    return this.node(id)
  }

  get size () {
    return this.#nodes.size
  }

  knowsLatestOf (knowerNodeId, syncNodeId) {
    const knower = this.node(knowerNodeId)
    const syncNode = this.node(syncNodeId)
    const known = knower.knownFor(syncNodeId)
    return known === syncNode.length
  }

  syncBetween (a, b) {
    // Gossip others states
    a.receiveGossipedStates(b.othersStates())
    b.receiveGossipedStates(a.othersStates())

    for (const [newNode, length] of a.sync(b)) {
      this.#onEdgeChange(a, this.node(newNode), length)
    }

    for (const [newNode, length] of b.sync(a)) {
      this.#onEdgeChange(b, this.node(newNode), length)
    }

    // both a and b have the same state now
    a.onSyncComplete(b.id)
    b.onSyncComplete(a.id)
  }

  syncRandom () {
    const a = this.randomNode()
    let toSync = randomInt(1, Math.floor(this.size / 2))

    while (toSync--) {
      const b = this.randomNode()
      this.syncBetween(a, b)
    }
  }

  incrementRandom () {
    this.randomNode().incrementLength()
  }
}

class Node {
  #id = 0
  // Map<id, length>
  #ownState = new Map()
  // Map<id, Map<id, length>
  #othersStates = new Map()

  constructor (id, initialLength = 0) {
    this.#id = id
    this.#ownState.set(id, initialLength)
  }

  get length () {
    return this.#ownState.get(this.#id) ?? 0
  }

  get id () {
    return this.#id
  }

  ownState () {
    return structuredClone(this.#ownState)
  }

  othersStates () {
    return structuredClone(this.#othersStates)
  }

  othersState (id) {
    return structuredClone(this.#othersStates.get(id))
  }

  knownFor (id) {
    return this.#ownState.get(id) ?? 0
  }

  // pull-syncs with node (updates lengths to lengths from node)
  sync (otherNode) {
    const newNodes = new Map()
    for (const [nodeId, length] of otherNode.ownState()) {
      const currentLength = this.#ownState.get(nodeId) ?? 0
      this.#ownState.set(nodeId, Math.max(currentLength, length))
      if (currentLength < length) newNodes.set(nodeId, length)
    }

    return newNodes
  }

  onSyncComplete (nodeId) {
    // node has same sync state as this node
    this.#othersStates.set(nodeId, structuredClone(this.#ownState))
  }

  receiveGossipedStates (othersStates) {
    for (const [otherNodeId, otherNodeState] of othersStates) {
      if (otherNodeId === this.#id) continue // skip self
      const currentOtherStateKnowledge =
        this.#othersStates.get(otherNodeId) ?? new Map()
      for (const [nodeId, length] of otherNodeState) {
        const currentLength = currentOtherStateKnowledge.get(nodeId) ?? 0
        currentOtherStateKnowledge.set(nodeId, Math.max(currentLength, length))
      }
      this.#othersStates.set(otherNodeId, currentOtherStateKnowledge)
    }
  }

  incrementLength (count = 1) {
    const currentLength = this.#ownState.get(this.#id) ?? 0
    this.#ownState.set(this.#id, currentLength + count)
  }
}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
