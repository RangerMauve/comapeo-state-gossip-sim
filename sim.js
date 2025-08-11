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
    const known = knower.lengthFor(syncNodeId)
    return known === syncNode.length
  }

  syncRandom () {
    // Two random peers
    const a = this.randomNode()
    const b = this.randomNode()
    // Sync a->b
    for (const [foundKnown] of a.sync(b)) {
      this.#onEdgeChange(a, this.node(foundKnown))
    }
    // Sync b->a
    for (const [foundKnown] of b.sync(a)) {
      this.#onEdgeChange(b, this.node(foundKnown))
    }
  }

  incrementRandom () {
    this.randomNode().incrementLength()
  }
}

class Node {
  #id = 0
  #length = 0
  // Map<id, length>
  #syncs = new Map()
  // Map<id, Map<id, length>
  #knownSyncs = new Map()

  constructor (id, initialLength = 0) {
    this.#id = id
    this.#length = initialLength
    this.#setSync(id, initialLength)
  }

  get length () {
    return this.#length
  }

  get id () {
    return this.#id
  }

  get knownSyncs () {
    return structuredClone(this.#knownSyncs)
  }

  get syncs () {
    return structuredClone(this.#syncs)
  }

  // Syncs node and returns changed knowns
  sync (node) {
    // Update knownSyncs from others
    for (const [knowerId, syncs] of node.knownSyncs) {
      if (knowerId === this.#id) continue
      for (const [syncerId, length] of syncs) {
        const knownLength = this.#knownFor(knowerId, syncerId)
        // TODO: Track this event?
        if (knownLength < length) this.#updateKnown(knowerId, syncerId, length)
      }
    }

    // Sync from node via ask, simulates hypercore sync
    const newLengths = new Map()
    for (const [syncerId, length] of node.syncs) {
      const knownLength = this.lengthFor(syncerId)
      if (knownLength >= length) continue
      newLengths.set(syncerId, length)
      this.#setSync(syncerId, length)
    }
    node.updateFrom(this.#id, newLengths)

    return newLengths

    // Return newly found lengths
  }

  updateFrom (fromNodeId, newLengths) {
    for (const [syncerId, length] of newLengths) {
      const knownLength = this.#knownFor(fromNodeId, syncerId)
      if (knownLength >= length) continue
      this.#updateKnown(fromNodeId, syncerId, length)
    }
  }

  incrementLength (count = 1) {
    this.#length += count
    this.#setSync(this.#id, this.#length)
  }

  #setSync (id, length) {
    this.#syncs.set(id, length)
    this.#updateKnown(this.#id, id, length)
  }

  lengthFor (syncerId) {
    return this.#syncs.get(syncerId) ?? 0
  }

  #knownFor (knowerId, syncerId) {
    if (!this.#knownSyncs.has(knowerId)) return 0
    return this.#knownSyncs.get(knowerId).get(syncerId) ?? 0
  }

  #updateKnown (knowerId, syncerId, length) {
    if (!this.#knownSyncs.has(knowerId)) {
      this.#knownSyncs.set(knowerId, new Map())
    }
    this.#knownSyncs.get(knowerId).set(syncerId, length)
  }
}

function randomInt (min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
