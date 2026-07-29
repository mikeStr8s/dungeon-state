<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';

	let fileInput = $state<HTMLInputElement | null>(null);

	async function onImport(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) await store.importFile(file);
		input.value = '';
	}
</script>

<section class="panel">
	<button onclick={() => store.exportSave()}>Export save</button>
	<button onclick={() => fileInput?.click()}>Import save</button>
	<button class="danger" data-testid="reset" onclick={() => store.reset()}>Reset campaign</button>
	<input bind:this={fileInput} type="file" accept="application/json" onchange={onImport} hidden />
</section>

<style>
	.panel {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.danger {
		margin-left: auto;
	}
</style>
