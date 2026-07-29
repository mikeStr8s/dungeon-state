// In-game clock formatting. Minutes are absolute from campaign start; day 1 begins at
// minute 0.

export function formatClock(minutes: number): string {
	const dayMinutes = ((minutes % 1440) + 1440) % 1440;
	const day = Math.floor(minutes / 1440) + 1;
	const hh = String(Math.floor(dayMinutes / 60)).padStart(2, '0');
	const mm = String(dayMinutes % 60).padStart(2, '0');
	return `Day ${day} · ${hh}:${mm}`;
}

export function formatDuration(minutes: number): string {
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h}h ${m}m` : `${h}h`;
}
