<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { bundledPacks } from '$lib/content/contentPack';
	import type { ContentPack } from '$lib/engine';

	let fileInput = $state<HTMLInputElement | null>(null);
	const currentPackId = $derived(store.world?.canon.packId);

	function load(p: ContentPack) {
		if (confirm(`Load "${p.name}"? This replaces the current campaign.`)) store.loadPack(p);
	}

	async function onImport(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		if (f) await store.importPackText(await f.text());
		input.value = '';
	}
</script>

<section class="panel" data-testid="library">
	<h2>Adventures</h2>
	<ul>
		{#each bundledPacks as p (p.id)}
			<li>
				<span class="name" class:active={p.id === currentPackId}>{p.name}</span>
				<button data-testid={'load-' + p.id} onclick={() => load(p)}>Load</button>
			</li>
		{/each}
	</ul>
	<div class="actions">
		<button class="secondary" data-testid="import-pack" onclick={() => fileInput?.click()}
			>Import pack</button
		>
		<button class="secondary" data-testid="export-pack" onclick={() => store.exportPack()}
			>Export as pack</button
		>
		<input bind:this={fileInput} type="file" accept=".json,.yaml,.yml" onchange={onImport} hidden />
	</div>
	{#if store.packErrors.length}
		<ul class="errors" data-testid="pack-errors">
			{#each store.packErrors as err (err)}
				<li>{err}</li>
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
		gap: var(--margin-xxs);
	}
	li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--margin-xs);
	}
	.name.active {
		color: var(--color-green);
		font-weight: 700;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--margin-xs);
	}
	.errors {
		color: var(--color-red);
		font: var(--small);
	}
</style>
