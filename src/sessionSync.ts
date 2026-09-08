import { TFile, Notice } from 'obsidian';
import GuildObsidianPlugin from './main';
import { GuildApiClient, GuildSession, GuildWorld } from './api';
import { createNoteFromTemplate } from './templateUtils';

export interface SyncResult {
	created: number;
	updated: number;
	total: number;
}

export function getSessionFilePath(plugin: GuildObsidianPlugin, session: GuildSession, worldName = 'General'): string {
	const folderPath = plugin.settings.sessionsFolder.trim().replace(/^\/+|\/+$/g, '') || 'Sessions';
	const rawDate = session.date || session.startDate;
	let formattedDate = 'Undated';
	if (rawDate) {
		const d = new Date(rawDate);
		if (!isNaN(d.getTime())) {
			formattedDate = d.toISOString().split('T')[0];
		} else {
			formattedDate = String(rawDate).split('T')[0];
		}
	}

	let filenamePattern = plugin.settings.filenameFormat.trim() || '{date} {world}';
	filenamePattern = filenamePattern
		.replace('{date}', formattedDate)
		.replace('YYYY-MM-DD', formattedDate)
		.replace('{world}', worldName)
		.replace('WORLDNAME', worldName)
		.replace('{system}', session.system)
		.replace('{id}', session._id);

	const sanitizedFilename = filenamePattern.replace(/[/\\?%*:|"<>]/g, '-').trim();
	const finalFilename = sanitizedFilename.endsWith('.md') ? sanitizedFilename : `${sanitizedFilename}.md`;
	return `${folderPath}/${finalFilename}`;
}

export async function syncSingleSession(plugin: GuildObsidianPlugin, session: GuildSession): Promise<TFile> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);
	const worlds = await client.getWorlds().catch(() => []);
	const worldMap = new Map<string, string>();
	worlds.forEach(w => {
		if (w._id) {
			worldMap.set(w._id, w.name);
			worldMap.set(w._id.toLowerCase(), w.name);
		}
		if (w.name) {
			worldMap.set(w.name, w.name);
			worldMap.set(w.name.toLowerCase(), w.name);
		}
	});

	let rawWorld: string | undefined = session.worldName || session.worldId || session.world_id || (typeof session.world === 'string' ? session.world : session.world?.name);
	if (!rawWorld && plugin.settings.selectedWorldId && plugin.settings.selectedWorldId !== 'ALL') {
		rawWorld = plugin.settings.selectedWorldId;
	}

	let worldName = 'General';
	if (rawWorld) {
		const mapped = worldMap.get(rawWorld) || worldMap.get(rawWorld.toLowerCase());
		worldName = mapped || rawWorld.replace(/\b\w/g, c => c.toUpperCase());
	}

	const filePath = getSessionFilePath(plugin, session, worldName);

	const folderPath = plugin.settings.sessionsFolder.trim().replace(/^\/+|\/+$/g, '') || 'Sessions';
	const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
	if (!folder) {
		await plugin.app.vault.createFolder(folderPath);
	}

	let playerWikilinks: string[] = [];
	try {
		const characters = await client.getSessionCharacters(session._id);
		playerWikilinks = characters.map(c => `[[${c.name}]]`);
	} catch {
		if (session.attendingCharacters) {
			playerWikilinks = session.attendingCharacters.map(id => `[[${id}]]`);
		}
	}

	const frontmatterProps: Record<string, unknown> = {
		[plugin.settings.sessionIdPropertyKey]: session._id,
		[plugin.settings.worldPropertyKey]: worldName,
		[plugin.settings.systemPropertyKey]: session.system,
		[plugin.settings.playersPropertyKey]: playerWikilinks,
	};

	const startDateValue = session.startDate || session.date;
	if (startDateValue) {
		frontmatterProps[plugin.settings.startDatePropertyKey] = startDateValue;
	}

	const endDateValue = session.endDate || startDateValue;
	if (endDateValue) {
		frontmatterProps[plugin.settings.endDatePropertyKey] = endDateValue;
	}

	let existingFile = plugin.app.vault.getAbstractFileByPath(filePath);
	if (!(existingFile instanceof TFile)) {
		const files = plugin.app.vault.getMarkdownFiles();
		const idKey = plugin.settings.sessionIdPropertyKey || 'guild_session_id';
		for (const file of files) {
			const cache = plugin.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && cache.frontmatter[idKey] === session._id) {
				existingFile = file;
				break;
			}
		}
	}

	if (existingFile instanceof TFile) {
		await plugin.app.fileManager.processFrontMatter(existingFile, (fm) => {
			Object.assign(fm, frontmatterProps);
		});
		return existingFile;
	} else {
		return await createNoteFromTemplate(
			plugin.app,
			filePath,
			plugin.settings.templateFilePath,
			frontmatterProps
		);
	}
}

export async function pushSession(plugin: GuildObsidianPlugin, sessionId: string): Promise<boolean> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);
	const files = plugin.app.vault.getMarkdownFiles();
	const idKey = plugin.settings.sessionIdPropertyKey || 'guild_session_id';

	let targetFile: TFile | null = null;
	for (const file of files) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		if (cache?.frontmatter && cache.frontmatter[idKey] === sessionId) {
			targetFile = file;
			break;
		}
	}

	if (!targetFile) {
		new Notice('Guild Obsidian: Local session note not found to push.');
		return false;
	}

	const cache = plugin.app.metadataCache.getFileCache(targetFile);
	const fm = cache?.frontmatter || {};

	const updateData: Partial<GuildSession> = {};

	const startKey = plugin.settings.startDatePropertyKey || 'startDate';
	const locationKey = 'location';
	const planningKey = 'planning';

	if (fm[startKey] !== undefined) updateData.startDate = String(fm[startKey]);
	if (fm[locationKey] !== undefined) updateData.location = String(fm[locationKey]);
	if (fm[planningKey] !== undefined) updateData.planning = String(fm[planningKey]);

	try {
		await client.updateSession(sessionId, updateData);
		new Notice(`Guild Obsidian: Successfully pushed session updates for session ${sessionId}`);
		return true;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Guild Obsidian: Failed to push session: ${msg}`);
		return false;
	}
}

export async function syncSessions(plugin: GuildObsidianPlugin): Promise<SyncResult> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);

	let upcomingSessions: GuildSession[] = [];
	let pastSessions: GuildSession[] = [];

	try {
		upcomingSessions = await client.getSessions(false, plugin.settings.selectedWorldId);
	} catch (err) {
		console.warn('Guild Obsidian: Failed to fetch upcoming sessions', err);
	}

	try {
		pastSessions = await client.getSessions(true, plugin.settings.selectedWorldId);
	} catch (err) {
		console.warn('Guild Obsidian: Failed to fetch past sessions', err);
	}

	const sessionMap = new Map<string, GuildSession>();
	[...upcomingSessions, ...pastSessions].forEach(s => sessionMap.set(s._id, s));
	const sessions = Array.from(sessionMap.values());

	if (sessions.length === 0) {
		new Notice('Guild Obsidian: No sessions found to sync.');
		return { created: 0, updated: 0, total: 0 };
	}

	let createdCount = 0;
	let updatedCount = 0;

	for (const session of sessions) {
		const file = await syncSingleSession(plugin, session);
		if (file) {
			// Count updated vs created based on stats if needed
			updatedCount++;
		}
	}

	const total = sessions.length;
	new Notice(`Guild Obsidian: Sync complete. Total: ${total}`);
	return { created: createdCount, updated: updatedCount, total };
}
