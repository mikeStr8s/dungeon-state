// Small hand-made pack used by unit tests — keeps tests independent of the shipped
// sample dungeon.

import type { ContentPack } from './pack.ts';

export function makeTestPack(): ContentPack {
	return {
		id: 'test',
		name: 'Test Pack',
		startAt: 600,
		seed: 42,
		startRoom: 'r1',
		rooms: [
			{ id: 'r1', name: 'Room 1', originalText: 'A plain stone room.', light: 'dark' },
			{ id: 'r2', name: 'Room 2', originalText: 'A dusty corridor.', light: 'dark' }
		],
		entities: [
			{
				id: 'torch',
				kind: 'light',
				name: 'Torch',
				location: 'r1',
				state: 'unlit',
				data: { duration: 60 }
			},
			{
				id: 'spell',
				kind: 'effect',
				name: 'Bless',
				location: 'r1',
				state: 'active',
				data: { endsAt: 610 }
			},
			{
				id: 'door',
				kind: 'door',
				name: 'Oak Door',
				location: 'r1',
				state: 'closed',
				data: { travelTime: 4 },
				relationships: [{ type: 'connects', target: 'r2' }]
			}
		]
	};
}
