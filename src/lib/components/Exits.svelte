<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { exitsFrom, partyRoom } from '$lib/engine';

	const world = $derived(store.world);
	const room = $derived(world ? partyRoom(world) : undefined);
	const exits = $derived(world && room ? exitsFrom(world, room.id) : []);

	function roomName(id: string): string {
		return world?.entities[id]?.name ?? id;
	}
</script>

<section class="panel" data-testid="exits">
	<h2>Exits</h2>
	{#if !room}
		<p class="empty">Party not placed.</p>
	{:else if exits.length === 0}
		<p class="empty">No way out of here.</p>
	{:else}
		<ul>
			{#each exits as x (x.connectionId)}
				<li>
					{#if x.passable}
						<button
							data-testid={'go-' + x.connectionId}
							onclick={() => store.moveParty(x.connectionId)}
						>
							Go to {roomName(x.toRoom)} · {x.travelTime}m
						</button>
					{:else}
						<span class="blocked">{roomName(x.toRoom)} — {x.blockedBy}</span>
						<button
							class="secondary"
							data-testid={'unlock-' + x.connectionId}
							onclick={() => store.setDoorState(x.connectionId, 'closed')}>Unlock</button
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	h2 {
		margin: 0;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--margin-xs);
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--margin-xs);
	}
	.blocked {
		flex: 1;
		color: var(--color-text-subtle);
	}
	.empty {
		color: var(--color-text-muted);
	}
</style>
