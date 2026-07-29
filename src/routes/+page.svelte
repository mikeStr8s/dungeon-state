<script lang="ts">
	import { onMount } from 'svelte';
	import { store } from '$lib/state/worldStore.svelte';
	import Search from '$lib/components/Search.svelte';
	import AdvanceControls from '$lib/components/AdvanceControls.svelte';
	import RoomPanel from '$lib/components/RoomPanel.svelte';
	import RoomList from '$lib/components/RoomList.svelte';
	import Exits from '$lib/components/Exits.svelte';
	import Factions from '$lib/components/Factions.svelte';
	import Proposals from '$lib/components/Proposals.svelte';
	import Notifications from '$lib/components/Notifications.svelte';
	import TimersList from '$lib/components/TimersList.svelte';
	import HistoryLog from '$lib/components/HistoryLog.svelte';
	import Library from '$lib/components/Library.svelte';
	import Plugins from '$lib/components/Plugins.svelte';
	import SaveControls from '$lib/components/SaveControls.svelte';

	onMount(() => {
		store.init();
	});
</script>

<svelte:head>
	<title>Living Dungeon Engine</title>
</svelte:head>

<main>
	<header class="title">
		<h1>Living Dungeon Engine</h1>
		<p class="small">{store.world?.canon.packName ?? 'Loading…'}</p>
	</header>

	{#if store.loading}
		<p class="small">Loading campaign…</p>
	{:else}
		<Search />
		<div class="layout">
			<div class="left">
				<AdvanceControls />
				<RoomList />
				<Notifications />
				<TimersList />
			</div>
			<div class="center">
				<RoomPanel />
				<Exits />
				<Proposals />
			</div>
			<div class="right">
				<Factions />
				<HistoryLog />
				<Library />
				<Plugins />
				<SaveControls />
			</div>
		</div>
	{/if}
</main>

<style>
	main {
		max-width: 80rem;
		margin: 0 auto;
		padding: var(--margin-m);
		display: flex;
		flex-direction: column;
		gap: var(--margin-m);
	}
	.title {
		display: flex;
		align-items: baseline;
		gap: var(--margin-s);
	}
	.title h1 {
		font: var(--h2);
	}
	.layout {
		display: grid;
		grid-template-columns: 20rem minmax(0, 1fr) 18rem;
		gap: var(--margin-m);
		align-items: start;
	}
	.left,
	.center,
	.right {
		display: flex;
		flex-direction: column;
		gap: var(--margin-m);
	}
	@media (max-width: 900px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
</style>
