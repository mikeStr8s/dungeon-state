<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { isPluginEnabled, plugins } from '$lib/engine';

	// read pluginVersion so the list recomputes when a toggle flips the (module-level) state
	const rows = $derived.by(() => {
		store.pluginVersion;
		return plugins().map((p) => ({ p, enabled: isPluginEnabled(p.id) }));
	});
</script>

<section class="panel" data-testid="plugins">
	<h2>Plugins</h2>
	{#if rows.length === 0}
		<p class="empty">None loaded.</p>
	{:else}
		<ul>
			{#each rows as { p, enabled } (p.id)}
				<li>
					<label>
						<input
							type="checkbox"
							checked={enabled}
							data-testid={'plugin-' + p.id}
							onchange={() => store.togglePlugin(p.id)}
						/>
						<span class="name">{p.name}</span>
					</label>
					<span class="desc">{p.description}</span>
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
		flex-direction: column;
		gap: var(--margin-xxs);
	}
	label {
		display: flex;
		align-items: center;
		gap: var(--margin-xs);
		cursor: pointer;
	}
	.name {
		color: var(--color-text-primary);
	}
	.desc {
		font: var(--small);
		color: var(--color-text-muted);
	}
	.empty {
		color: var(--color-text-muted);
	}
</style>
