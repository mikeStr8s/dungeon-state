// Bundled adventures. Packs are validated at load time (a dev-time invariant); imported
// packs are validated in the store so the UI can show errors. Referential validation +
// export live in the engine (engine/packIO.ts).

import type { ContentPack } from '$lib/engine';
import { parseValidPackOrThrow } from '$lib/engine';
import sampleJson from './sample-dungeon.json';
import warrenJson from './goblin-warren.json';

export const samplePack: ContentPack = parseValidPackOrThrow(sampleJson);
export const goblinWarrenPack: ContentPack = parseValidPackOrThrow(warrenJson);

/** Adventures offered in the Library switcher. */
export const bundledPacks: ContentPack[] = [samplePack, goblinWarrenPack];
