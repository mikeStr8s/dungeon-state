<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { DURATIONS } from '$lib/engine';
	import { formatClock } from '$lib/util/time';

	let custom = $state(5);

	const presets: { label: string; delta: number }[] = [
		{ label: '1 min', delta: DURATIONS.minute },
		{ label: '10 min', delta: DURATIONS.tenMinutes },
		{ label: '1 hour', delta: DURATIONS.hour },
		{ label: 'Short rest', delta: DURATIONS.shortRest },
		{ label: 'Long rest', delta: DURATIONS.longRest }
	];
</script>

<section class="panel">
	<div class="clock" data-testid="clock">{formatClock(store.world?.now ?? 0)}</div>
	<div class="buttons">
		{#each presets as p (p.label)}
			<button
				data-testid={'advance-' + p.label.toLowerCase().replace(/\s+/g, '-')}
				onclick={() => store.advance(p.delta)}>{p.label}</button
			>
		{/each}
	</div>
	<div class="custom">
		<label>
			Custom
			<input type="number" min="1" bind:value={custom} data-testid="custom-minutes" />
			min
		</label>
		<button data-testid="custom-advance" onclick={() => store.advance(custom)}>Advance</button>
		<button
			class="secondary"
			data-testid="undo"
			disabled={!store.canUndo()}
			onclick={() => store.undo()}>Undo</button
		>
	</div>
</section>

<style>
	.panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.clock {
		font: var(--h3);
		color: var(--color-text-primary);
		font-variant-numeric: tabular-nums;
	}
	.buttons,
	.custom {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
	}
	input {
		width: 4rem;
	}
</style>
