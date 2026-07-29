// Registers the bundled plugins as an import side-effect. The store imports this once so
// the built-in extension set is available. Third-party plugins would register the same way.

import { registerPlugin } from '$lib/engine';
import { environmentalPlugin } from './environmental.ts';

registerPlugin(environmentalPlugin);

export { environmentalPlugin };
