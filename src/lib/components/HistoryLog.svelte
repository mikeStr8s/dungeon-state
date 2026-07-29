<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { activeEventIds, describeEvent } from '$lib/engine';
	import { formatClock } from '$lib/util/time';

	let filter = $state('');

	// newest first by in-game time; ties keep causal (insertion) order, newest on top.
	// The stored log stays insertion-ordered — this only sorts the display.
	const world = $derived(store.world);
	const active = $derived(world ? activeEventIds(world.log) : new Set<string>());
	const sorted = $derived(
		world
			? world.log
					.map((ev, i) => ({ ev, i }))
					.sort((a, b) => b.ev.at - a.ev.at || b.i - a.i)
					.map((x) => x.ev)
			: []
	);
	const shown = $derived(
		filter.trim() && world
			? sorted.filter((ev) => describeEvent(ev, world).toLowerCase().includes(filter.toLowerCase()))
			: sorted
	);
</script>

<section class="panel" data-testid="history">
	<h2>History <span class="count" data-testid="history-count">{sorted.length}</span></h2>
	<input class="filter" data-testid="history-filter" placeholder="Filter…" bind:value={filter} />
	<ul>
		{#each shown as ev (ev.id)}
			<li class:cancelled={!active.has(ev.id)}>
				<span class="at">{formatClock(ev.at)}</span>
				<span class="type">{world ? describeEvent(ev, world) : ev.type}</span>
				{#if active.has(ev.id) && ev.type !== 'RolledBack'}
					<button
						class="btn-flat rollback"
						title="rewind to here"
						data-testid={'rollback-' + ev.id}
						onclick={() => store.rollbackTo(ev.id)}>⟲</button
					>
				{/if}
			</li>
		{/each}
	</ul>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	h2 {
		margin: 0;
	}
	.count {
		font: var(--small);
		color: var(--color-text-subtle);
	}
	.filter {
		padding: var(--margin-xxs) var(--margin-xs);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		max-height: 16rem;
		overflow-y: auto;
	}
	li {
		display: flex;
		gap: 0.75rem;
		font-size: 0.85rem;
		align-items: baseline;
	}
	li.cancelled {
		opacity: 0.4;
		text-decoration: line-through;
	}
	.at {
		color: var(--color-text-subtle);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.type {
		color: var(--color-text-secondary);
		flex: 1;
	}
	.rollback {
		color: var(--color-yellow);
	}
</style>
