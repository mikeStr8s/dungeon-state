<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { formatClock } from '$lib/util/time';
</script>

<section class="panel" data-testid="notifications">
	<h2>What changed</h2>
	{#if store.notifications.length === 0}
		<p class="empty">Advance time to see changes.</p>
	{:else}
		<ul>
			{#each store.notifications as n (n.sourceEventId)}
				<li>
					<span class="at">{formatClock(n.at)}</span>
					<span>{n.message}</span>
				</li>
			{/each}
		</ul>
	{/if}
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
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	li {
		display: flex;
		gap: 0.75rem;
	}
	.at {
		color: var(--color-text-subtle);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.empty {
		color: var(--color-text-muted);
	}
</style>
