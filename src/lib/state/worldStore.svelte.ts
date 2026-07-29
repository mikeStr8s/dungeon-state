// Reactive bridge between the pure engine and the UI. All simulation logic lives in
// the engine; this file only holds reactive state and wires engine ⇄ persistence.

import { browser } from '$app/environment';
import {
	activeEvents,
	addNote,
	advanceTime,
	apply,
	defeatCreature,
	describeEvent,
	extinguishSource,
	fold,
	initEvent,
	isNotable,
	lightSource,
	isPluginEnabled,
	moveParty,
	packFromState,
	partyRoom,
	rollbackEvent,
	rooms,
	setDoorState,
	setEntityData as setEntityDataEvent,
	setPluginEnabled,
	validatePack
} from '$lib/engine';
import type {
	ContentPack,
	EventEnvelope,
	FactionProposal,
	Notification,
	WorldState
} from '$lib/engine';
import { samplePack } from '$lib/content/contentPack';
import { parsePack } from '$lib/content/packFormat';
import '$lib/plugins'; // register bundled plugins (side-effect)
import { appendEvents, clearEvents, loadEvents, replaceEvents } from '$lib/persistence/db';
import { downloadJson, exportSave, importSave } from '$lib/persistence/saveFile';

class WorldStore {
	world = $state<WorldState | null>(null);
	notifications = $state<Notification[]>([]);
	selectedRoomId = $state<string | null>(null);
	dismissedProposals = $state<Set<string>>(new Set());
	packErrors = $state<string[]>([]);
	/** bumped on plugin toggle so plugin-dependent UI recomputes. */
	pluginVersion = $state(0);
	loading = $state(true);

	/** Load the log from IndexedDB, seeding the sample pack on first run. */
	async init(): Promise<void> {
		if (!browser) return;
		let events = await loadEvents();
		if (events.length === 0) {
			const seed = initEvent(samplePack);
			await appendEvents([seed]);
			events = [seed];
		}
		this.setWorld(fold(events));
		this.loading = false;
	}

	private setWorld(state: WorldState): void {
		this.world = state;
		if (!this.selectedRoomId || !state.entities[this.selectedRoomId]) {
			this.selectedRoomId = partyRoom(state)?.id ?? rooms(state)[0]?.id ?? null;
		}
	}

	private async commit(events: EventEnvelope[], state: WorldState): Promise<void> {
		await appendEvents(events);
		this.world = state;
	}

	async advance(delta: number): Promise<void> {
		if (!this.world) return;
		const { state, newEvents, notifications } = advanceTime(this.world, delta);
		await this.commit(newEvents, state);
		this.notifications = notifications;
	}

	/** Apply a list of DM-action events (each stamped at the current clock) and persist. */
	private async dispatch(events: EventEnvelope[]): Promise<void> {
		if (!this.world || events.length === 0) return;
		const next = events.reduce((s, e) => apply(s, e), this.world);
		await this.commit(events, next);
	}

	async lightTorch(lightId: string): Promise<void> {
		if (this.world) await this.dispatch(lightSource(this.world, lightId));
	}

	async extinguish(lightId: string): Promise<void> {
		if (this.world) await this.dispatch(extinguishSource(this.world, lightId));
	}

	async defeatCreature(id: string): Promise<void> {
		if (this.world) await this.dispatch(defeatCreature(this.world, id));
	}

	async setDoorState(id: string, doorState: string): Promise<void> {
		if (this.world) await this.dispatch(setDoorState(this.world, id, doorState));
	}

	async addNote(id: string, text: string): Promise<void> {
		if (this.world) await this.dispatch(addNote(this.world, id, text));
	}

	async setEntityData(id: string, patch: Record<string, unknown>): Promise<void> {
		if (this.world) await this.dispatch(setEntityDataEvent(this.world, id, patch));
	}

	/** Approve a faction proposal: commit its events and surface them as notifications. */
	async approveProposal(proposal: FactionProposal): Promise<void> {
		if (!this.world) return;
		const events = proposal.build(this.world);
		await this.dispatch(events);
		const w = this.world;
		this.notifications = events
			.filter((e) => isNotable(e))
			.map((e) => ({ at: e.at, message: describeEvent(e, w), sourceEventId: e.id }));
	}

	dismissProposal(id: string): void {
		this.dismissedProposals = new Set(this.dismissedProposals).add(id);
	}

	/** Rewind: append a non-destructive marker cancelling everything after `eventId`. */
	async rollbackTo(eventId: string): Promise<void> {
		if (!this.world) return;
		const marker = rollbackEvent(this.world, eventId);
		await appendEvents([marker]);
		this.setWorld(fold(await loadEvents()));
		this.notifications = [
			{ at: this.world.now, message: 'Rolled back to an earlier point.', sourceEventId: marker.id }
		];
	}

	/** Undo the most recent action (rolls back to the previous active event). */
	async undo(): Promise<void> {
		if (!this.world) return;
		const active = activeEvents(this.world.log);
		if (active.length < 2) return;
		await this.rollbackTo(active[active.length - 2].id);
	}

	/** Whether there is an action to undo (for disabling the UI control). */
	canUndo(): boolean {
		return !!this.world && activeEvents(this.world.log).length >= 2;
	}

	/** Traverse a connection: advances time, moves the party, follows them in the view. */
	async moveParty(connectionId: string): Promise<void> {
		if (!this.world) return;
		const { state, newEvents, notifications } = moveParty(this.world, connectionId);
		if (newEvents.length === 0) return;
		await this.commit(newEvents, state);
		this.notifications = notifications;
		this.selectedRoomId = partyRoom(state)?.id ?? this.selectedRoomId;
	}

	selectRoom(id: string): void {
		this.selectedRoomId = id;
	}

	exportSave(): void {
		if (this.world) exportSave(this.world.log);
	}

	async importFile(file: File): Promise<void> {
		const events = await importSave(file);
		await replaceEvents(events);
		this.setWorld(fold(events));
		this.notifications = [];
	}

	async reset(): Promise<void> {
		await clearEvents();
		const seed = initEvent(samplePack);
		await appendEvents([seed]);
		this.setWorld(fold([seed]));
		this.notifications = [];
		this.dismissedProposals = new Set();
	}

	/** Replace the current campaign with a fresh one from a content pack. Destructive. */
	async loadPack(pack: ContentPack): Promise<void> {
		await clearEvents();
		const init = initEvent(pack);
		await appendEvents([init]);
		this.selectedRoomId = null; // let setWorld pick a room from the new pack
		this.setWorld(fold([init]));
		this.notifications = [];
		this.dismissedProposals = new Set();
		this.packErrors = [];
	}

	/** Parse + validate imported pack text; load it, or surface validation errors. */
	async importPackText(text: string): Promise<void> {
		let raw: unknown;
		try {
			raw = parsePack(text);
		} catch (e) {
			this.packErrors = [`Parse error: ${(e as Error).message}`];
			return;
		}
		const { pack, errors } = validatePack(raw);
		if (!pack) {
			this.packErrors = errors;
			return;
		}
		await this.loadPack(pack);
	}

	/** Enable/disable a plugin (affects future advances only). */
	togglePlugin(id: string): void {
		setPluginEnabled(id, !isPluginEnabled(id));
		this.pluginVersion += 1;
	}

	/** Export the current live campaign as a reusable content pack (JSON). */
	exportPack(): void {
		if (this.world) {
			downloadJson(
				packFromState(this.world),
				`${this.world.canon.packId || 'adventure'}-pack.json`
			);
		}
	}
}

export const store = new WorldStore();
