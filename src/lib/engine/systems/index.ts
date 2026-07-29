// System registry. Each system reacts to time advancing by producing events. They run
// in fixed priority order (doc pipeline: torches → spells → …), and each system sees
// the state left by earlier ones — that ordering is applied in time.ts.

import type { EventEnvelope, WorldState } from '../types.ts';
import { pluginSystems } from '../plugins.ts';
import { lightSystem } from './light.ts';
import { effectSystem } from './effects.ts';
import { patrolSystem } from './patrol.ts';
import { wanderingSystem } from './wandering.ts';
import { factionUpkeepSystem } from './factions.ts';

export interface System {
	name: string;
	/** lower runs first. */
	priority: number;
	run(state: WorldState, from: number, to: number): EventEnvelope[];
}

/** First-party systems, always present. */
export const builtinSystems: System[] = [
	lightSystem,
	patrolSystem,
	effectSystem,
	factionUpkeepSystem,
	wanderingSystem
];

/** Built-ins + enabled-plugin systems, in run order. Recomputed each advance so plugin
 *  toggles take effect immediately. */
export function activeSystems(): System[] {
	return [...builtinSystems, ...pluginSystems()].sort((a, b) => a.priority - b.priority);
}
