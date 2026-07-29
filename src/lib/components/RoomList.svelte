<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { isOccupied, partyRoom, rooms } from '$lib/engine';

	const world = $derived(store.world);
	const list = $derived(world ? rooms(world) : []);
	const partyRoomId = $derived(world ? partyRoom(world)?.id : undefined);
</script>

<section class="panel" data-testid="room-list">
	<h2>Dungeon</h2>
	<ul>
		{#each list as r (r.id)}
			<li>
				<button
					class="btn-flat row"
					class:selected={r.id === store.selectedRoomId}
					onclick={() => store.selectRoom(r.id)}
				>
					<span class="name" class:unexplored={r.state === 'unexplored'}>{r.name}</span>
					{#if r.id === partyRoomId}
						<span class="party" data-testid="party-marker">◆</span>
					{/if}
					{#if world && isOccupied(world, r.id)}
						<span class="tag hostile" data-testid={'occupied-' + r.id}>occupied</span>
					{/if}
					{#if r.state === 'unexplored'}
						<span class="tag">unexplored</span>
					{/if}
				</button>
			</li>
		{/each}
	</ul>
</section>

<style>
	h2 {
		margin: 0;
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--margin-xxs);
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--margin-xs);
		width: 100%;
		text-align: left;
	}
	.selected .name {
		color: var(--color-text-primary);
		font-weight: 700;
	}
	.name {
		flex: 1;
		color: var(--color-text-secondary);
	}
	.name.unexplored {
		color: var(--color-text-subtle);
	}
	.party {
		color: var(--color-yellow);
	}
	.tag {
		font: var(--smaller);
		padding: 0.1rem 0.4rem;
		background: var(--color-bg-secondary);
		color: var(--color-text-muted);
	}
	.tag.hostile {
		color: var(--color-red);
	}
</style>
