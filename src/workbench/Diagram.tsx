import { useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant, MiniMap, Handle, Position, useReactFlow, useViewport } from '@xyflow/react';
import type { Node, Edge, NodeProps, EdgeProps, Connection } from '@xyflow/react';
import { Maximize, Minus, Plus, Scan, Lock, Cable } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import type { Scene, SceneNode, SceneEdge, EntityRef } from '../scene/types.ts';
import { nodeMarkup, edgeMarkup, markers } from '../scene/primitives.ts';
import { themes } from '../scene/theme.ts';
import type { ThemeName } from '../scene/theme.ts';
type StudioNode = Node<{
    visual: SceneNode;
    theme: ThemeName;
    editing: boolean;
}, 'studio'>;
type StudioEdge = Edge<{
    visual: SceneEdge;
    theme: ThemeName;
}, 'studio'>;
const position = { WEST: Position.Left, EAST: Position.Right, NORTH: Position.Top, SOUTH: Position.Bottom };
function ModelNode({ data, selected }: NodeProps<StudioNode>) {
    const n = data.visual;
    return <div className={`studio-node ${n.shape === 'group' ? 'group-node' : ''} ${selected ? 'is-selected' : ''}`} data-model-node={n.id}>
    <svg width={n.width} height={n.height} viewBox={`0 0 ${n.width} ${n.height}`} role="img" aria-label={n.label} dangerouslySetInnerHTML={{ __html: nodeMarkup(n, themes[data.theme]) }}/>
    {n.ports.map(p => <Handle key={p.id} id={p.id} type={p.direction === 'out' ? 'source' : 'target'} position={position[p.side]} isConnectable={data.editing && n.ref?.collection === 'blocks'} style={{ left: p.x, top: p.y, right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', width: 12, height: 12 }} title={`${p.id} · ${p.direction}${p.quantity ? ' · ' + p.quantity : ''}`}/>)}
  </div>;
}
function ModelEdge({ data, selected }: EdgeProps<StudioEdge>) {
    if (!data)
        return null;
    const e = data.visual;
    return <g className={selected ? 'selected-model-edge' : ''}>
    <g dangerouslySetInnerHTML={{ __html: edgeMarkup(e, themes[data.theme], 'studio-ui') }}/>
    {e.paths.map((points, i) => <path key={i} className="react-flow__edge-interaction" d={points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')} stroke="transparent" strokeWidth={18} fill="none"/>)}
  </g>;
}
const nodeTypes = { studio: ModelNode }, edgeTypes = { studio: ModelEdge };
function Viewport({ scene, theme, onSelect, selected, onConnect }: {
    scene: Scene;
    theme: ThemeName;
    selected?: EntityRef;
    onSelect(ref?: EntityRef): void;
    onConnect(connection: Connection): void;
}) {
    const api = useReactFlow<StudioNode, StudioEdge>(), viewport = useViewport();
    const host = useRef<HTMLDivElement>(null), previousKey = useRef(''), [fitting, setFitting] = useState(true), [editing, setEditing] = useState(false);
    const nodes = useMemo<StudioNode[]>(() => scene.nodes.map(n => ({ id: n.id, type: 'studio', position: { x: n.x, y: n.y }, width: n.width, height: n.height, initialWidth: n.width, initialHeight: n.height, style: { width: n.width, height: n.height }, data: { visual: n, theme, editing }, selectable: !!n.ref, draggable: false, connectable: n.ref?.collection === 'blocks', selected: !!selected && n.ref?.collection === selected.collection && n.ref?.id === selected.id, zIndex: n.shape === 'group' ? -2 : 1 })), [scene, theme, editing, selected]);
    const edges = useMemo<StudioEdge[]>(() => scene.edges.map(e => ({ id: e.id, type: 'studio', source: e.from, target: e.to, sourceHandle: e.fromPort, targetHandle: e.toPort, data: { visual: e, theme }, selectable: true, selected: !!selected && e.ref.collection === selected.collection && e.ref.id === selected.id, zIndex: 0 })), [scene, theme, selected]);
    const fit = () => { setFitting(true); void api.fitView({ padding: .06, minZoom: .05, maxZoom: 1, duration: 0 }); };
    useEffect(() => {
        const key = `${scene.title}/${scene.viewId}/${scene.mode}`;
        if (previousKey.current !== key) {
            previousKey.current = key;
            setFitting(true);
            requestAnimationFrame(() => void api.fitView({ padding: .06, maxZoom: 1, minZoom: .05 }));
        }
        else if (fitting)
            requestAnimationFrame(() => void api.fitView({ padding: .06, maxZoom: 1, minZoom: .05 }));
    }, [scene, api]);
    useEffect(() => { if (!host.current)
        return; const observer = new ResizeObserver(() => { if (fitting)
        requestAnimationFrame(() => void api.fitView({ padding: .06, maxZoom: 1, minZoom: .05 })); }); observer.observe(host.current); return () => observer.disconnect(); }, [api, fitting]);
    return <div className={`diagram-area ${editing ? 'connecting' : ''}`} ref={host} data-testid="diagram" data-scene-width={scene.width} data-view-id={scene.viewId} data-revision={scene.revision} data-zoom={viewport.zoom}>
    <div className="canvas-toolbar"><span className="canvas-caption">{scene.viewKind.toUpperCase()} VIEW <i /> {scene.nodes.filter(n => n.ref && n.shape !== 'group').length} elements {scene.hiddenConnections > 0 && <b>· {scene.hiddenConnections} boundary connections omitted</b>}</span>
      <div className="zoom-tools">
        {scene.viewKind === 'control' && <button className={editing ? 'active' : ''} onClick={() => setEditing(!editing)} title="Create a connection between declared ports" aria-pressed={editing}><Cable size={14}/> Connect</button>}
        <button aria-label="Zoom out" onClick={() => { setFitting(false); void api.zoomOut(); }}><Minus size={14}/></button><output data-testid="zoom-value">{Math.round(viewport.zoom * 100)}%</output>
        <button aria-label="Zoom in" onClick={() => { setFitting(false); void api.zoomIn(); }}><Plus size={14}/></button>
        <button data-testid="native-scale" onClick={() => { setFitting(false); void api.zoomTo(1, { duration: 0 }); }} title="One scene unit per CSS pixel">1:1</button>
        <button data-testid="fit" onClick={fit}><Scan size={14}/> Fit</button>
      </div>
    </div>
    <div className="flow-host">
      <ReactFlow<StudioNode, StudioEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} nodesDraggable={false} nodesConnectable={editing} edgesReconnectable={false} deleteKeyCode={null} minZoom={.05} maxZoom={4} onMoveStart={event => { if (event)
        setFitting(false); }} onNodeClick={(_, n) => onSelect(n.data.visual.ref)} onEdgeClick={(_, e) => onSelect(e.data!.visual.ref)} onPaneClick={() => onSelect(undefined)} onConnect={onConnect} fitView fitViewOptions={{ padding: .06, minZoom: .05, maxZoom: 1 }} colorMode={theme === 'midnight' ? 'dark' : 'light'} style={{ background: themes[theme].background }} ariaLabelConfig={{ 'controls.zoomIn.ariaLabel': 'Zoom in', 'controls.zoomOut.ariaLabel': 'Zoom out' }}>
        <svg style={{ position: 'absolute', width: 0, height: 0, overflow: 'visible' }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: markers(themes[theme], 'studio-ui') }}/>
        <Background variant={BackgroundVariant.Dots} color={theme === 'midnight' ? '#2c4057' : '#ced8e6'} gap={20} size={1}/>
        <MiniMap position="bottom-right" pannable zoomable nodeColor={n => (n as StudioNode).data.visual.tone === 'accent' ? '#72bdb2' : '#b0bfd1'} style={{ width: 140, height: 88 }}/>
      </ReactFlow>
    </div>
    <div className="canvas-bottom"><span><Lock size={11}/> Geometry compiled from the model</span><span>{fitting ? 'Fit to view' : 'Native viewport'} · Drag canvas to pan · Scroll / pinch to zoom</span></div>
  </div>;
}
export function Diagram(props: Parameters<typeof Viewport>[0]) { return <ReactFlowProvider><Viewport {...props}/></ReactFlowProvider>; }
