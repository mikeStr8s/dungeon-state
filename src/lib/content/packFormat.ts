// Pack file parsing. YAML is a JSON superset, so js-yaml's `load` handles both `.json`
// and `.yaml`/`.yml` imports through one path. Validation happens separately
// (engine/packIO.ts) on the parsed object.

import { load } from 'js-yaml';

export function parsePack(text: string): unknown {
	return load(text);
}
