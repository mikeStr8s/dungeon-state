// Save-file export / import. A save is just the event log wrapped with a version tag —
// the whole campaign is reconstructable by folding it. Browser-only (Blob/FileReader).

import type { EventEnvelope } from '$lib/engine';

const SAVE_VERSION = 1;

export interface SaveFile {
	version: number;
	exportedAt: string;
	events: EventEnvelope[];
}

/** Trigger a download of the current event log as a JSON save file. */
export function exportSave(events: EventEnvelope[], filename = 'dungeon-save.json'): void {
	const save: SaveFile = { version: SAVE_VERSION, exportedAt: new Date().toISOString(), events };
	const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** Trigger a download of any JSON-serializable data. */
export function downloadJson(data: unknown, filename: string): void {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

/** Parse an imported save file into its event log. */
export async function importSave(file: File): Promise<EventEnvelope[]> {
	const text = await file.text();
	const parsed = JSON.parse(text) as SaveFile;
	if (!parsed || !Array.isArray(parsed.events)) {
		throw new Error('Invalid save file: missing events[]');
	}
	return parsed.events;
}
