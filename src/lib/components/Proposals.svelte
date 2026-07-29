<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { proposeFactionActions } from '$lib/engine';

	// derived, explainable suggestions — recomputed from live state, minus dismissed ones
	const world = $derived(store.world);
	const proposals = $derived(
		world ? proposeFactionActions(world).filter((p) => !store.dismissedProposals.has(p.id)) : []
	);
</script>

<section class="panel" data-testid="proposals">
	<h2>Proposed actions <span class="count">{proposals.length}</span></h2>
	{#if proposals.length === 0}
		<p class="empty">No suggested actions right now.</p>
	{:else}
		<ul>
			{#each proposals as p (p.id)}
				<li data-testid={'proposal-' + p.id}>
					<div class="title">{p.title}</div>
					<div class="reason">{p.reason}</div>
					<div class="acts">
						<button data-testid={'approve-' + p.id} onclick={() => store.approveProposal(p)}
							>Approve</button
						>
						<button
							class="secondary"
							data-testid={'dismiss-' + p.id}
							onclick={() => store.dismissProposal(p.id)}>Dismiss</button
						>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<style>
	h2 {
		margin: 0;
	}
	.count {
		font: var(--small);
		color: var(--color-text-subtle);
	}
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--margin-s);
	}
	li {
		display: flex;
		flex-direction: column;
		gap: var(--margin-xxs);
		border-left: 2px solid var(--color-purple);
		padding-left: var(--margin-xs);
	}
	.title {
		color: var(--color-text-primary);
	}
	.reason {
		font: var(--small);
		color: var(--color-text-muted);
	}
	.acts {
		display: flex;
		gap: var(--margin-xs);
	}
	.empty {
		color: var(--color-text-muted);
	}
</style>
