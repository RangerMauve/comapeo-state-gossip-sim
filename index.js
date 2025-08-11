import { Sim } from './sim.js'
import { Graph, Layout, Renderer } from './springy.js'

const MAX_NODES = 8
const SYNC_INTERVAL = 2000
const INCREMENT_INTERVAL = 4000

const simNodeToGraphNode = new Map()

const graph = new Graph()
const layout = new Layout.ForceDirected(graph, 10.0, 2000.0, 0.1, -1)

const sim = new Sim({
  onNew (node) {
    simNodeToGraphNode.set(node, graph.newNode(node))
  },
  onEdgeChange (fromNode, toNode) {
    const graphFrom = simNodeToGraphNode.get(fromNode)
    const graphTo = simNodeToGraphNode.get(toNode)
    const exists = graph
      .getEdges(graphFrom, graphTo).length
    if (exists) return
    graph.newEdge(graphFrom, graphTo)
  }
})

window.sim = sim
window.graph = graph

const renderer = new Renderer(layout,
  function clear () {},
  function drawEdge (edge, p1, p2) {
    const line = getEdge(edge)
    line.setAttribute('x1', p1.x.toFixed(4))
    line.setAttribute('y1', p1.y.toFixed(4))
    line.setAttribute('x2', p2.x.toFixed(4))
    line.setAttribute('y2', p2.y.toFixed(4))

    const isSynced = sim.knowsLatestOf(edge.source.id, edge.target.id)
    line.setAttribute('stroke', isSynced ? '#00FF00' : '#FF0000')
  },
  function drawNode (node, p) {
    const circle = getNode(node)
    /// onsole.log(node, circle)
    circle.setAttribute('cx', p.x.toFixed(4))
    circle.setAttribute('cy', p.y.toFixed(4))
  })

sim.spawnMany(MAX_NODES)
sim.syncRandom()
renderer.start()

setInterval(() => sim.syncRandom(), SYNC_INTERVAL)
setInterval(() => sim.incrementRandom(), INCREMENT_INTERVAL)

function getEdge (edge) {
  const domId = `edge_${edge.id}`
  const existing = window[domId]
  if (existing) return existing
  const svgNS = 'http://www.w3.org/2000/svg'
  const line = document.createElementNS(svgNS, 'line')
  line.setAttribute('id', domId)
  line.setAttribute('stroke', 'green')
  line.setAttribute('stroke-width', '0.25')
  window.edgeContainer.appendChild(line)
  return line
}

function getNode (node) {
  const percentage = node.id / MAX_NODES
  const domId = `node_${node.id}`
  const existing = window[domId]
  if (existing) return existing
  const svgNS = 'http://www.w3.org/2000/svg'
  const circle = document.createElementNS(svgNS, 'circle')
  circle.setAttribute('id', domId)
  circle.setAttribute('r', '1')
  circle.setAttribute('fill', hslFromPercentage(percentage))
  window.canvas.appendChild(circle)
  return circle
}

function hslFromPercentage (percentage) {
  const hue = Math.round(360 * percentage)
  return `hsl(${hue}, 100%, 50%)`
}
