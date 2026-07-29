<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { timersRemaining } from '$lib/engine';
	import { formatDuration } from '$lib/util/time';

	const timers = $derived(store.world ? timersRemaining(store.world) : []);
</script>

<section class="panel">
	<h2>Active timers</h2>
	{#if timers.length === 0}
		<p class="empty">Nothing burning or ticking.</p>
	{:else}
		<ul>
			{#each timers as t (t.entityId)}
				<li>
					<span>{t.label}</span>
					<span class="remaining">{formatDuration(t.remaining)}</span>
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
		justify-content: space-between;
		gap: 1rem;
	}
	.remaining {
		color: var(--color-yellow);
		font-variant-numeric: tabular-nums;
	}
	.empty {
		color: var(--color-text-muted);
	}
</style>
