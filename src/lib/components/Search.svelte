<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { search } from '$lib/engine';
	import type { SearchResult } from '$lib/engine';
	import { formatClock } from '$lib/util/time';

	let query = $state('');
	const results = $derived(store.world && query.trim() ? search(store.world, query) : []);

	function go(r: SearchResult) {
		if (r.roomId) store.selectRoom(r.roomId);
	}
</script>

<section class="panel" data-testid="search">
	<input
		data-testid="search-input"
		placeholder="Search rooms, monsters, factions, notes, history…"
		bind:value={query}
	/>
	{#if query.trim()}
		<ul data-testid="search-results">
			{#each results as r (r.kind + ':' + r.id)}
				<li>
					<button class="btn-flat row" data-testid={'result-' + r.id} onclick={() => go(r)}>
						<span class="cat">{r.category}</span>
						<span class="title">{r.title}</span>
						<span class="sub">
							{r.kind === 'event' && r.at != null ? formatClock(r.at) : r.subtitle}
						</span>
					</button>
				</li>
			{:else}
				<li class="empty">No matches.</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	input {
		width: 100%;
		padding: var(--margin-xxs) var(--margin-xs);
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--margin-xxs);
		max-height: 16rem;
		overflow-y: auto;
	}
	.row {
		display: flex;
		align-items: baseline;
		gap: var(--margin-xs);
		width: 100%;
		text-align: left;
	}
	.cat {
		font: var(--smaller);
		text-transform: uppercase;
		color: var(--color-text-subtle);
		width: 4.5rem;
		flex-shrink: 0;
	}
	.title {
		flex: 1;
		color: var(--color-text-secondary);
	}
	.sub {
		font: var(--small);
		color: var(--color-text-muted);
		white-space: nowrap;
	}
	.empty {
		color: var(--color-text-muted);
	}
</style>
