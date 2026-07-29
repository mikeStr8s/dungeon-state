<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { factionMembers, factions, territoryOf } from '$lib/engine';
	import type { Entity } from '$lib/engine';

	const world = $derived(store.world);
	const list = $derived(world ? factions(world) : []);

	const morale = (f: Entity) => (typeof f.data.morale === 'number' ? f.data.morale : 0);
	const resources = (f: Entity) => (typeof f.data.resources === 'number' ? f.data.resources : 0);
	const objective = (f: Entity) => (typeof f.data.objective === 'string' ? f.data.objective : '');
</script>

<section class="panel" data-testid="factions">
	<h2>Factions</h2>
	{#if list.length === 0}
		<p class="empty">None.</p>
	{:else}
		<ul>
			{#each list as f (f.id)}
				<li>
					<div class="head">
						<span class="name">{f.name}</span>
						<span class="obj">{objective(f)}</span>
					</div>
					<div class="bar"><div class="fill" style="width:{morale(f)}%"></div></div>
					<div class="stats">
						<span data-testid={'morale-' + f.id}>morale {morale(f)}</span>
						<span data-testid={'resources-' + f.id}>res {resources(f)}</span>
						<span>terr {territoryOf(f).length}</span>
						<span>mem {world ? factionMembers(world, f.id).length : 0}</span>
						<button
							class="btn-flat"
							title="lower morale"
							onclick={() => store.setEntityData(f.id, { morale: Math.max(0, morale(f) - 5) })}
							>−</button
						>
						<button
							class="btn-flat"
							title="raise morale"
							onclick={() => store.setEntityData(f.id, { morale: Math.min(100, morale(f) + 5) })}
							>+</button
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
	ul {
		display: flex;
		flex-direction: column;
		gap: var(--margin-s);
	}
	li {
		display: flex;
		flex-direction: column;
		gap: var(--margin-xxs);
	}
	.head {
		display: flex;
		justify-content: space-between;
		gap: var(--margin-xs);
	}
	.name {
		color: var(--color-text-primary);
	}
	.obj {
		font: var(--smaller);
		color: var(--color-text-subtle);
	}
	.bar {
		height: 0.4rem;
		background: var(--color-bg-secondary);
	}
	.fill {
		height: 100%;
		background: var(--color-green);
	}
	.stats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--margin-xs);
		align-items: center;
		font: var(--small);
		color: var(--color-text-muted);
	}
	.stats button {
		min-width: 1.4rem;
	}
	.empty {
		color: var(--color-text-muted);
	}
</style>
