import { TFile, Notice } from 'obsidian';
import GuildObsidianPlugin from './main';
import { GuildApiClient, GuildSession, GuildWorld } from './api';

export interface SyncResult {
	created: number;
	updated: number;
	total: number;
}

export async function syncSessions(plugin: GuildObsidianPlugin): Promise<SyncResult> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);

	// Fetch Worlds for mapping
	let worlds: GuildWorld[] = [];
	try {
		worlds = await client.getWorlds();
	} catch (err) {
		console.warn('Guild Obsidian: Failed to fetch worlds list', err);
	}

	const worldMap = new Map<string, string>();
	worlds.forEach(w => worldMap.set(w._id, w.name));

	// Fetch Sessions (both upcoming and past)
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

	// Deduplicate sessions by _id
	const sessionMap = new Map<string, GuildSession>();
	[...upcomingSessions, ...pastSessions].forEach(s => sessionMap.set(s._id, s));
	const sessions = Array.from(sessionMap.values());

	if (sessions.length === 0) {
		new Notice('Guild Obsidian: No sessions found to sync.');
		return { created: 0, updated: 0, total: 0 };
	}

	// Ensure Target Folder Exists
	const folderPath = plugin.settings.sessionsFolder.trim().replace(/^\/+|\/+$/g, '') || 'Sessions';
	const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
	if (!folder) {
		await plugin.app.vault.createFolder(folderPath);
	}

	let createdCount = 0;
	let updatedCount = 0;

	for (const session of sessions) {
		const worldName = session.worldId ? (worldMap.get(session.worldId) || 'Unknown World') : 'General';
		
		// Date formatting
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

		// Generate Filename
		let filenamePattern = plugin.settings.filenameFormat.trim() || '{date} {world}';
		
		// Support both {date} and YYYY-MM-DD placeholder styles
		filenamePattern = filenamePattern
			.replace('{date}', formattedDate)
			.replace('YYYY-MM-DD', formattedDate)
			.replace('{world}', worldName)
			.replace('WORLDNAME', worldName)
			.replace('{system}', session.system)
			.replace('{id}', session._id);

		// Sanitize filename for operating system forbidden characters
		const sanitizedFilename = filenamePattern.replace(/[/\\?%*:|"<>]/g, '-').trim();
		const finalFilename = sanitizedFilename.endsWith('.md') ? sanitizedFilename : `${sanitizedFilename}.md`;
		const filePath = `${folderPath}/${finalFilename}`;

		// Fetch Attending Characters
		let playerWikilinks: string[] = [];
		try {
			const characters = await client.getSessionCharacters(session._id);
			playerWikilinks = characters.map(c => `[[${c.name}]]`);
		} catch {
			// If session characters endpoint is unavailable, fallback to character IDs if available
			if (session.attendingCharacters) {
				playerWikilinks = session.attendingCharacters.map(id => `[[${id}]]`);
			}
		}

		// Construct Frontmatter Properties
		const frontmatterProps: Record<string, unknown> = {
			[plugin.settings.sessionIdPropertyKey]: session._id,
			[plugin.settings.worldPropertyKey]: worldName,
			[plugin.settings.systemPropertyKey]: session.system,
			[plugin.settings.playersPropertyKey]: playerWikilinks,
		};

		if (session.startDate) {
			frontmatterProps[plugin.settings.startDatePropertyKey] = session.startDate;
		} else if (session.date) {
			frontmatterProps[plugin.settings.startDatePropertyKey] = session.date;
		}

		if (session.endDate) {
			frontmatterProps[plugin.settings.endDatePropertyKey] = session.endDate;
		}

		// Sync Note
		let existingFile = plugin.app.vault.getAbstractFileByPath(filePath);

		if (existingFile instanceof TFile) {
			// File exists: Update frontmatter ONLY without disturbing body or Templater code
			await plugin.app.fileManager.processFrontMatter(existingFile, (fm) => {
				Object.assign(fm, frontmatterProps);
			});
			updatedCount++;
		} else {
			// New File: Check for Template File
			let initialContent = '';
			if (plugin.settings.templateFilePath.trim()) {
				const templateFile = plugin.app.vault.getAbstractFileByPath(plugin.settings.templateFilePath.trim());
				if (templateFile instanceof TFile) {
					initialContent = await plugin.app.vault.read(templateFile);
				}
			}

			// Create file with initial content/template body
			const newFile = await plugin.app.vault.create(filePath, initialContent);
			
			// Inject frontmatter cleanly
			await plugin.app.fileManager.processFrontMatter(newFile, (fm) => {
				Object.assign(fm, frontmatterProps);
			});
			createdCount++;
		}
	}

	const total = sessions.length;
	new Notice(`Guild Obsidian: Sync complete. Created: ${createdCount}, Updated: ${updatedCount}, Total: ${total}`);
	return { created: createdCount, updated: updatedCount, total };
}
