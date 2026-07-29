/**
 * End-to-end smoke + visual verification for the Living Dungeon Engine.
 *
 * Runs against a real Chromium (so IndexedDB works), walks the core DM flow, asserts
 * DOM state at each step, and writes a screenshot per step into e2e/screenshots/. Boots
 * its own `vite preview` server and tears it down. Exits nonzero on any failure.
 *
 * Chromium: uses PUPPETEER_EXECUTABLE_PATH or /usr/bin/chromium (puppeteer-core ships
 * no browser). Run via `bun run test:e2e` (which builds first).
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import puppeteer, { type Browser, type Page } from 'puppeteer-core';

const PORT = 4173;
const BASE = `http://localhost:${PORT}`;
const CHROMIUM = process.env.PUPPETEER_EXECUTABLE_PATH ?? '/usr/bin/chromium';
const ROOT = dirname(fileURLToPath(import.meta.url));
const SHOT_DIR = join(ROOT, 'screenshots');

const TORCH = 'light-torch-entry'; // entity id of the Party Torch in the sample pack

function testid(id: string): string {
	return `[data-testid="${id}"]`;
}

async function waitForServer(url: string, timeoutMs = 30_000): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			const res = await fetch(url);
			if (res.ok) return;
		} catch {
			/* not up yet */
		}
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`Server at ${url} did not become ready in ${timeoutMs}ms`);
}

function startPreview(): ChildProcess {
	const child = spawn('bun', ['run', 'preview', '--', '--port', String(PORT), '--strictPort'], {
		cwd: join(ROOT, '..'),
		detached: true,
		stdio: 'ignore'
	});
	return child;
}

function stopPreview(child: ChildProcess): void {
	if (child.pid) {
		try {
			process.kill(-child.pid, 'SIGTERM'); // kill the whole process group
		} catch {
			/* already gone */
		}
	}
}

async function text(page: Page, sel: string): Promise<string> {
	return page.$eval(sel, (el) => (el.textContent ?? '').trim());
}

async function main(): Promise<void> {
	await mkdir(SHOT_DIR, { recursive: true });
	const userDataDir = await mkdtemp(join(tmpdir(), 'lde-e2e-'));

	const server = startPreview();
	let browser: Browser | undefined;
	let page: Page | undefined;
	const pageErrors: string[] = [];
	let step = 0;

	const shot = async (name: string) => {
		step += 1;
		const file = join(SHOT_DIR, `${String(step).padStart(2, '0')}-${name}.png`);
		await page!.screenshot({ path: file, fullPage: true });
		console.log(`  📸 ${file}`);
	};

	try {
		await waitForServer(BASE);
		browser = await puppeteer.launch({
			executablePath: CHROMIUM,
			headless: true,
			args: ['--no-sandbox', '--disable-setuid-sandbox'],
			userDataDir,
			defaultViewport: { width: 1280, height: 900 }
		});
		page = await browser.newPage();
		page.on('dialog', (d) => d.accept()); // auto-accept confirm() dialogs
		page.on('pageerror', (e) => pageErrors.push(String(e)));
		page.on('console', (m) => {
			if (m.type() === 'error') pageErrors.push(m.text());
		});

		// ---- Flow 1: initial render -------------------------------------------
		console.log('› Flow 1: initial render');
		await page.goto(BASE, { waitUntil: 'networkidle0' });
		await page.waitForSelector(testid('clock'));
		await page.waitForFunction(
			(sel) => (document.querySelector(sel)?.textContent ?? '').includes('10:00'),
			{ timeout: 10_000 },
			testid('clock')
		);
		assert.match(await text(page, testid('clock')), /Day 1 · 10:00/);
		assert.match(await page.$eval('body', (b) => b.textContent ?? ''), /The Sample Catacombs/);
		const roomCount = await page.$$eval(`${testid('room-select')} option`, (os) => os.length);
		assert.equal(roomCount, 3, 'expected 3 rooms');
		await shot('initial');

		// ---- Flow 2: light the torch ------------------------------------------
		console.log('› Flow 2: light torch');
		await page.select(testid('room-select'), 'room-entry');
		await page.waitForSelector(testid(`light-${TORCH}`));
		await page.click(testid(`light-${TORCH}`));
		await page.waitForFunction(
			(sel) => document.querySelector(sel)?.textContent?.trim() === 'bright',
			{ timeout: 10_000 },
			testid('room-light')
		);
		assert.equal(await text(page, testid('room-light')), 'bright');
		await page.waitForSelector(testid(`extinguish-${TORCH}`)); // button flipped
		await shot('torch-lit');

		// ---- Flow 3: advance 1 hour -> burnout --------------------------------
		console.log('› Flow 3: advance 1 hour');
		await page.click(testid('advance-1-hour'));
		await page.waitForFunction(
			(sel) => /burned out/i.test(document.querySelector(sel)?.textContent ?? ''),
			{ timeout: 10_000 },
			testid('notifications')
		);
		assert.equal(
			await text(page, testid('room-light')),
			'dark',
			'room should be dark after burnout'
		);
		assert.match(await text(page, testid('clock')), /Day 1 · 11:00/);
		await shot('after-advance');

		// ---- Flow 4: persistence across reload ---------------------------------
		console.log('› Flow 4: reload (IndexedDB persistence)');
		await page.reload({ waitUntil: 'networkidle0' });
		await page.waitForFunction(
			(sel) => (document.querySelector(sel)?.textContent ?? '').includes('11:00'),
			{ timeout: 10_000 },
			testid('clock')
		);
		assert.match(await text(page, testid('clock')), /Day 1 · 11:00/, 'clock must survive reload');
		assert.equal(await text(page, testid('room-light')), 'dark', 'burnt-out state must persist');
		await shot('after-reload');

		// ---- Flow 5: reset campaign -------------------------------------------
		console.log('› Flow 5: reset');
		await page.click(testid('reset'));
		await page.waitForFunction(
			(sel) => (document.querySelector(sel)?.textContent ?? '').includes('10:00'),
			{ timeout: 10_000 },
			testid('clock')
		);
		assert.match(await text(page, testid('clock')), /Day 1 · 10:00/, 'reset returns to start');
		await page.waitForSelector(testid(`light-${TORCH}`)); // torch lightable again
		await shot('after-reset');

		// ---- Flow 6: move party (travel advances time + explores) --------------
		console.log('› Flow 6: move party');
		// party starts in the entry room; the entry→guardpost door has travelTime 1
		await page.waitForSelector(testid('party-here')); // party marker in the current room panel
		await page.click(testid('go-door-entry-guard'));
		await page.waitForFunction(
			(sel) => (document.querySelector(sel)?.textContent ?? '').includes('10:01'),
			{ timeout: 10_000 },
			testid('clock')
		);
		assert.match(await text(page, testid('clock')), /Day 1 · 10:01/, 'travel advanced the clock');
		assert.equal(
			await page.$eval(testid('room-select'), (el) => (el as HTMLSelectElement).value),
			'room-guardpost',
			'view follows the party into the guard post'
		);
		await page.waitForSelector(testid('party-here')); // party marker now in the guard post
		assert.match(await text(page, testid('room-state')), /explored/, 'destination is now explored');
		// the Bugbear Sentry (patrol) is in the guard post → room reads occupied
		await page.waitForSelector(testid('room-occupied'));
		await shot('after-move');

		// ---- Flow 7: living world — patrols move, monsters wander in -----------
		console.log('› Flow 7: living world');
		await page.click(testid('advance-1-hour')); // 10:01 → 11:01
		// a wandering monster appears at the 11:00 check boundary
		await page.waitForFunction(
			(sel) => /appeared/i.test(document.querySelector(sel)?.textContent ?? ''),
			{ timeout: 10_000 },
			testid('notifications')
		);
		const changed = await text(page, testid('notifications'));
		assert.match(changed, /appeared/i, 'a wandering monster appeared');
		// the Bugbear patrolled (entry at :30, back to guard post at :00) — visible in History
		assert.match(await text(page, testid('history')), /moved to/i, 'a creature patrolled');
		await shot('living-world');

		// ---- Flow 8: factions — approve a proposal ----------------------------
		console.log('› Flow 8: factions');
		await page.waitForSelector(testid('factions'));
		await page.waitForSelector(testid('proposals'));
		const numOf = (s: string) => parseInt(s.replace(/\D/g, ''), 10);
		const resBefore = numOf(await text(page, testid('resources-faction-bugbears')));
		// approve the Bugbear Warband recruit proposal (id "faction-bugbears:recruit")
		await page.click(testid('approve-faction-bugbears:recruit'));
		await page.waitForFunction(
			(sel, prev) => {
				const el = document.querySelector(sel);
				return el ? parseInt((el.textContent || '').replace(/\D/g, ''), 10) !== prev : false;
			},
			{ timeout: 10_000 },
			testid('resources-faction-bugbears'),
			resBefore
		);
		const resAfter = numOf(await text(page, testid('resources-faction-bugbears')));
		assert.equal(resAfter, resBefore - 15, 'recruit spent 15 resources');
		await shot('factions');

		// ---- Flow 9: search + undo -------------------------------------------
		console.log('› Flow 9: search + undo');
		await page.type(testid('search-input'), 'crypt');
		await page.waitForSelector(testid('search-results'));
		await page.waitForSelector(testid('result-room-crypt'));
		await page.click(testid('result-room-crypt'));
		assert.equal(
			await page.$eval(testid('room-select'), (el) => (el as HTMLSelectElement).value),
			'room-crypt',
			'clicking a search result navigates to its room'
		);
		// undo the last committed action (appends a non-destructive rollback marker)
		const histBefore = numOf(await text(page, testid('history-count')));
		await page.click(testid('undo'));
		await page.waitForFunction(
			(sel) => /rolled back/i.test(document.querySelector(sel)?.textContent ?? ''),
			{ timeout: 10_000 },
			testid('notifications')
		);
		const histAfter = numOf(await text(page, testid('history-count')));
		assert.ok(histAfter > histBefore, 'rollback appended a marker to the full log');
		await shot('search-undo');

		// ---- Flow 10: adventure import (load a different pack) ----------------
		console.log('› Flow 10: adventure import');
		await page.waitForSelector(testid('library'));
		await page.click(testid('load-goblin-warren')); // confirm() auto-accepted
		// wait on the real load signal: the room list now holds the new pack's rooms
		await page.waitForFunction(
			(sel) => {
				const s = document.querySelector(sel) as HTMLSelectElement | null;
				return !!s && Array.from(s.options).some((o) => o.value === 'warren-mouth');
			},
			{ timeout: 10_000 },
			testid('room-select')
		);
		const packRooms = await page.$$eval(`${testid('room-select')} option`, (os) =>
			os.map((o) => (o as HTMLOptionElement).value)
		);
		assert.ok(packRooms.includes('warren-mouth'), 'the new adventure replaced the campaign');
		await page.waitForSelector(testid('export-pack'));
		await shot('adventure');

		// ---- Flow 11: plugins — environmental flooding ------------------------
		console.log('› Flow 11: plugins');
		await page.click(testid('reset')); // back to the sample (its crypt has a floodRate)
		await page.waitForFunction(
			(sel) => (document.querySelector(sel)?.textContent ?? '').includes('10:00'),
			{ timeout: 10_000 },
			testid('clock')
		);
		await page.waitForSelector(testid('plugins'));
		await page.waitForSelector(testid('plugin-environmental')); // bundled plugin listed
		await page.select(testid('room-select'), 'room-crypt');
		await page.click(testid('advance-1-hour')); // one hour → crypt floods by its rate (20)
		await page.waitForSelector(testid('room-flood'));
		assert.match(
			await text(page, testid('room-flood')),
			/20%/,
			'the flooding plugin raised the water'
		);
		await shot('plugins');

		assert.equal(pageErrors.length, 0, `console/page errors:\n${pageErrors.join('\n')}`);
		console.log('\n✅ All e2e flows passed.');
	} catch (err) {
		console.error('\n❌ e2e failed:', err instanceof Error ? err.message : err);
		if (page) {
			try {
				await page.screenshot({ path: join(SHOT_DIR, 'zz-failure.png'), fullPage: true });
				console.error(`  📸 ${join(SHOT_DIR, 'zz-failure.png')}`);
			} catch {
				/* ignore */
			}
		}
		process.exitCode = 1;
	} finally {
		if (browser) await browser.close();
		stopPreview(server);
		await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
	}
}

await main();
