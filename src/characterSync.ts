import { TFile, Notice } from 'obsidian';
import GuildObsidianPlugin from './main';
import { GuildApiClient, GuildCharacter, GuildWorld } from './api';
import { createNoteFromTemplate } from './templateUtils';

export interface CharacterSyncResult {
	created: number;
	updated: number;
	total: number;
}

export async function syncCharacters(plugin: GuildObsidianPlugin): Promise<CharacterSyncResult> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);

	// Fetch Characters
	let characters: GuildCharacter[] = [];
	try {
		characters = await client.getCharacters();
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Guild Obsidian: Failed to fetch characters: ${msg}`);
		return { created: 0, updated: 0, total: 0 };
	}

	if (characters.length === 0) {
		new Notice('Guild Obsidian: No characters found to sync.');
		return { created: 0, updated: 0, total: 0 };
	}

	// Fetch Reputation Data for Selected World(s)
	// Map: characterId -> Record<factionName, number>
	const characterReputationMap = new Map<string, Record<string, number>>();

	try {
		let targetWorldIds: string[] = [];
		if (plugin.settings.selectedWorldId && plugin.settings.selectedWorldId !== 'ALL') {
			targetWorldIds = [plugin.settings.selectedWorldId];
		} else {
			const worlds = await client.getWorlds().catch(() => []);
			targetWorldIds = worlds.map(w => w._id);
		}

		for (const worldId of targetWorldIds) {
			try {
				const repData = await client.getWorldReputation(worldId);
				parseReputationData(repData, characterReputationMap);
			} catch {
				// World might not have reputation system or endpoint failed
			}
		}
	} catch (err) {
		console.warn('Guild Obsidian: Reputation fetch skipped', err);
	}

	// Ensure Target Folder Exists
	const folderPath = plugin.settings.charactersFolder.trim().replace(/^\/+|\/+$/g, '') || 'Characters';
	const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
	if (!folder) {
		await plugin.app.vault.createFolder(folderPath);
	}

	let createdCount = 0;
	let updatedCount = 0;

	for (const character of characters) {
		// Generate Filename
		let pattern = plugin.settings.characterFilenameFormat.trim() || '{name}';
		pattern = pattern
			.replace('{name}', character.name)
			.replace('{id}', character._id)
			.replace('{lvl}', String(character.lvl))
			.replace('{level}', String(character.lvl))
			.replace('{class}', character.class || '')
			.replace('{ancestry}', character.ancestry || '')
			.replace('{system}', character.system || '')
			.replace('{rank}', character.rank || '');

		const sanitizedFilename = pattern.replace(/[/\\?%*:|"<>]/g, '-').trim();
		const finalFilename = sanitizedFilename.endsWith('.md') ? sanitizedFilename : `${sanitizedFilename}.md`;
		const filePath = `${folderPath}/${finalFilename}`;

		// Build Frontmatter object with custom property key mappings
		const frontmatterProps: Record<string, unknown> = {};

		if (plugin.settings.characterIdPropertyKey) {
			frontmatterProps[plugin.settings.characterIdPropertyKey] = character._id;
		}
		if (plugin.settings.characterNamePropertyKey) {
			frontmatterProps[plugin.settings.characterNamePropertyKey] = character.name;
		}
		if (plugin.settings.characterLevelPropertyKey) {
			frontmatterProps[plugin.settings.characterLevelPropertyKey] = character.lvl;
		}
		if (plugin.settings.characterXpPropertyKey) {
			frontmatterProps[plugin.settings.characterXpPropertyKey] = character.xp;
		}
		if (plugin.settings.characterClassPropertyKey && character.class) {
			frontmatterProps[plugin.settings.characterClassPropertyKey] = character.class;
		}
		if (plugin.settings.characterAncestryPropertyKey && character.ancestry) {
			frontmatterProps[plugin.settings.characterAncestryPropertyKey] = character.ancestry;
		}
		if (plugin.settings.characterSystemPropertyKey && character.system) {
			frontmatterProps[plugin.settings.characterSystemPropertyKey] = character.system;
		}
		if (plugin.settings.characterRankPropertyKey && character.rank) {
			frontmatterProps[plugin.settings.characterRankPropertyKey] = character.rank;
		}
		if (plugin.settings.characterWebsiteLinkPropertyKey && character.websiteLink) {
			frontmatterProps[plugin.settings.characterWebsiteLinkPropertyKey] = character.websiteLink;
		}
		if (plugin.settings.characterUserIdPropertyKey && character.userId) {
			frontmatterProps[plugin.settings.characterUserIdPropertyKey] = character.userId;
		}

		// Reputation mapping
		const reputationObj = characterReputationMap.get(character._id);
		if (reputationObj && Object.keys(reputationObj).length > 0 && plugin.settings.characterReputationPropertyKey) {
			frontmatterProps[plugin.settings.characterReputationPropertyKey] = reputationObj;
		}

		// Sync Note
		let existingFile = plugin.app.vault.getAbstractFileByPath(filePath);

		if (existingFile instanceof TFile) {
			// Update frontmatter only, keeping note body and Templater code intact
			await plugin.app.fileManager.processFrontMatter(existingFile, (fm) => {
				Object.assign(fm, frontmatterProps);
			});
			updatedCount++;
		} else {
			await createNoteFromTemplate(
				plugin.app,
				filePath,
				plugin.settings.characterTemplateFilePath,
				frontmatterProps
			);
			createdCount++;
		}
	}

	const total = characters.length;
	new Notice(`Guild Obsidian: Character sync complete. Created: ${createdCount}, Updated: ${updatedCount}, Total: ${total}`);
	return { created: createdCount, updated: updatedCount, total };
}

function parseReputationData(data: unknown, map: Map<string, Record<string, number>>) {
	if (!data) return;

	if (Array.isArray(data)) {
		data.forEach((entry: unknown) => {
			if (typeof entry === 'object' && entry !== null) {
				const e = entry as { characterId?: string; factionName?: string; score?: number; delta?: number };
				if (e.characterId && e.factionName) {
					const charRep = map.get(e.characterId) || {};
					charRep[e.factionName] = e.score ?? e.delta ?? 0;
					map.set(e.characterId, charRep);
				}
			}
		});
	} else if (typeof data === 'object') {
		// Could be a nested map { [characterId]: { [factionName]: score } }
		Object.entries(data as Record<string, unknown>).forEach(([charId, value]) => {
			if (typeof value === 'object' && value !== null) {
				const charRep = map.get(charId) || {};
				Object.entries(value as Record<string, unknown>).forEach(([faction, score]) => {
					if (typeof score === 'number') {
						charRep[faction] = score;
					}
				});
				map.set(charId, charRep);
			}
		});
	}
}
