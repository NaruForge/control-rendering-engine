export { parseModel, validateModel, jsonSchema, ModelError } from './model.ts';
export type { Model, Mode, Assignment } from './model.ts';
export { views } from './render.ts';
export type { Diagram, RenderOptions, View } from './render.ts';
export { themes } from './theme.ts';
export type { ThemeName } from './theme.ts';
import type { Model } from './model.ts';
import { compose } from './render.ts';
import type { Diagram, RenderOptions } from './render.ts';
export async function render(model: Model, options: RenderOptions = {}): Promise<Diagram> {
  const layout = options.view === 'signals' ? await (await import('./layout.ts')).layoutSignals(model) : undefined;
  return compose(model, options, layout);
}
