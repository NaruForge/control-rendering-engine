import type { Port, ViewDefinition } from '../domain/schema.ts';
export type Tone = 'ink' | 'muted' | 'accent' | 'violet' | 'amber';
export interface Point {
    x: number;
    y: number;
}
export interface EntityRef {
    collection: 'components' | 'blocks' | 'signals' | 'quantities' | 'modes' | 'views' | 'powerLinks';
    id: string;
}
export interface MathGlyph {
    body: string;
    viewBox: string;
    width: number;
    height: number;
}
export interface ScenePort extends Port, Point {
}
export interface TextLine {
    text: string;
    x: number;
    y: number;
    size: number;
    tone?: Tone;
    weight?: number;
    anchor?: 'start' | 'middle' | 'end';
}
export interface SceneNode extends Point {
    id: string;
    width: number;
    height: number;
    shape: 'card' | 'group' | 'text' | 'sum' | 'gain' | 'junction' | 'limiter' | 'switch';
    ref?: EntityRef;
    kind?: string;
    label: string;
    tone: Tone;
    texts: TextLine[];
    ports: ScenePort[];
    math?: MathGlyph;
    mathBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    parent?: string;
}
export interface SceneEdge {
    id: string;
    from: string;
    to: string;
    fromPort?: string;
    toPort?: string;
    ref: EntityRef;
    paths: Point[][];
    labels: {
        text: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }[];
    kind: 'signal' | 'feedback' | 'power' | 'off';
    startArrow: boolean;
    endArrow: boolean;
}
export interface AuditIssue {
    code: string;
    severity: 'error' | 'warning';
    message: string;
    ids: string[];
}
export interface Scene {
    schemaVersion: 1;
    title: string;
    description: string;
    viewId: string;
    viewKind: ViewDefinition['kind'];
    mode?: string;
    width: number;
    height: number;
    nodes: SceneNode[];
    edges: SceneEdge[];
    notes: string[];
    hiddenConnections: number;
    revision: string;
    audit: AuditIssue[];
}
