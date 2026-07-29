<script lang="ts">
	import { store } from '$lib/state/worldStore.svelte';
	import { canonEntity, entitiesInRoom, isOccupied, partyRoom, rooms } from '$lib/engine';
	import type { Entity } from '$lib/engine';

	const world = $derived(store.world);
	const roomList = $derived(world ? rooms(world) : []);
	const room = $derived(
		world && store.selectedRoomId ? world.entities[store.selectedRoomId] : null
	);
	// the party is shown as a header marker, not listed as room contents
	const occupants = $derived(
		world && room
			? entitiesInRoom(world, room.id).filter((e) => e.id !== room.id && e.kind !== 'party')
			: []
	);
	const canonRoom = $derived(world && room ? canonEntity(world, room.id) : undefined);
	const partyHere = $derived(world && room ? partyRoom(world)?.id === room.id : false);
	const occupied = $derived(world && room ? isOccupied(world, room.id) : false);

	function creatureTask(e: Entity): string {
		return typeof e.data.task === 'string' ? e.data.task : 'guard';
	}

	function light(e: Entity): string {
		return typeof e.data.light === 'string' ? e.data.light : 'dark';
	}
</script>

<section class="panel">
	<header>
		<h2>
			Current Room
			{#if partyHere}<span class="tag current" data-testid="party-here">◆ party here</span>{/if}
			{#if occupied}<span class="tag hostile" data-testid="room-occupied">occupied</span>{/if}
		</h2>
		<select
			data-testid="room-select"
			value={store.selectedRoomId}
			onchange={(e) => store.selectRoom(e.currentTarget.value)}
		>
			{#each roomList as r (r.id)}
				<option value={r.id}>{r.name}</option>
			{/each}
		</select>
	</header>

	{#if room}
		<div class="grid">
			<div class="col">
				<h3>Original <span class="tag">as published</span></h3>
				<p class="original">{canonRoom?.data.originalText ?? room.data.originalText}</p>
			</div>
			<div class="col">
				<h3>Current <span class="tag current">now</span></h3>
				<ul class="facts">
					<li>Light: <strong data-testid="room-light">{light(room)}</strong></li>
					<li>State: <strong data-testid="room-state">{room.state}</strong></li>
					<li>Occupants: <strong>{occupants.length}</strong></li>
					{#if typeof room.data.flood === 'number'}
						<li>Flood: <strong data-testid="room-flood">{room.data.flood}%</strong></li>
					{/if}
				</ul>
			</div>
		</div>

		<h3>Contents</h3>
		{#if occupants.length === 0}
			<p class="empty">Empty.</p>
		{:else}
			<ul class="entities">
				{#each occupants as e (e.id)}
					<li>
						<span class="kind">{e.kind}</span>
						<span class="name">{e.name}</span>
						{#if e.kind === 'creature' && e.state !== 'dead'}
							<span class="task">{creatureTask(e)}</span>
						{/if}
						<span class="state">{e.state}</span>
						{#if e.kind === 'light' && e.state !== 'lit'}
							<button data-testid={'light-' + e.id} onclick={() => store.lightTorch(e.id)}
								>Light</button
							>
						{:else if e.kind === 'light' && e.state === 'lit'}
							<button data-testid={'extinguish-' + e.id} onclick={() => store.extinguish(e.id)}
								>Extinguish</button
							>
						{:else if e.kind === 'creature' && e.state !== 'dead'}
							<button
								class="danger"
								data-testid={'defeat-' + e.id}
								onclick={() => store.defeatCreature(e.id)}>Defeat</button
							>
						{:else if e.kind === 'door'}
							{#if e.state === 'locked'}
								<button
									class="secondary"
									data-testid={'unlock-' + e.id}
									onclick={() => store.setDoorState(e.id, 'closed')}>Unlock</button
								>
							{:else if e.state === 'open'}
								<button
									class="secondary"
									data-testid={'close-' + e.id}
									onclick={() => store.setDoorState(e.id, 'closed')}>Close</button
								>
							{:else}
								<button
									class="secondary"
									data-testid={'open-' + e.id}
									onclick={() => store.setDoorState(e.id, 'open')}>Open</button
								>
							{/if}
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else}
		<p class="empty">No room selected.</p>
	{/if}
</section>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--margin-m);
	}
	.grid {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: var(--margin-m);
	}
	.tag {
		font: var(--smaller);
		padding: 0.1rem 0.4rem;
		background: var(--color-bg-secondary);
		color: var(--color-text-muted);
		vertical-align: middle;
	}
	.tag.current {
		background: var(--color-bg-secondary);
		color: var(--color-green);
	}
	.tag.hostile {
		background: var(--color-bg-secondary);
		color: var(--color-red);
	}
	.task {
		font: var(--smaller);
		text-transform: uppercase;
		color: var(--color-purple);
	}
	.original {
		font-style: italic;
		color: var(--color-text-muted);
	}
	.facts,
	.entities {
		display: flex;
		flex-direction: column;
		gap: var(--margin-xxs);
	}
	.entities li {
		display: flex;
		align-items: center;
		gap: var(--margin-xs);
	}
	.kind {
		font: var(--smaller);
		text-transform: uppercase;
		color: var(--color-text-subtle);
		width: 4.5rem;
	}
	.name {
		flex: 1;
	}
	.state {
		color: var(--color-green);
		font: var(--small);
	}
	.empty {
		color: var(--color-text-muted);
	}
</style>
