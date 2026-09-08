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

		// Reputation mapping: combine character payload reputation with world reputation API data
		const repFromChar = extractCharacterReputation(character);
		const repFromMap = characterReputationMap.get(character._id) || {};
		const mergedRep = { ...repFromChar, ...repFromMap };

		// Add reputation fields directly as top-level frontmatter properties (no leading 2 spaces / nested object)
		Object.entries(mergedRep).forEach(([factionName, score]) => {
			if (factionName && typeof score === 'number') {
				frontmatterProps[factionName] = score;
			}
		});

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

function extractCharacterReputation(character: GuildCharacter): Record<string, number> {
	const result: Record<string, number> = {};
	const rawRep = character.reputation || character.reputations || character.factions;
	if (!rawRep) return result;

	if (Array.isArray(rawRep)) {
		rawRep.forEach(item => {
			if (typeof item === 'object' && item !== null) {
				const name = (item.factionName || item.faction_name || item.faction || item.name || item.title) as string | undefined;
				const val = getNumericValue(item as Record<string, unknown>, ['score', 'value', 'amount', 'points', 'delta', 'reputation']);
				if (name && val !== undefined) {
					result[name] = val;
				}
			}
		});
	} else if (typeof rawRep === 'object') {
		Object.entries(rawRep as Record<string, unknown>).forEach(([key, val]) => {
			if (typeof val === 'number') {
				result[key] = val;
			} else if (typeof val === 'string' && !isNaN(Number(val))) {
				result[key] = Number(val);
			} else if (typeof val === 'object' && val !== null) {
				const numVal = getNumericValue(val as Record<string, unknown>, ['score', 'value', 'amount', 'points', 'delta', 'reputation']);
				if (numVal !== undefined) {
					result[key] = numVal;
				}
			}
		});
	}
	return result;
}

function parseReputationData(data: unknown, map: Map<string, Record<string, number>>) {
	if (!data) return;

	if (Array.isArray(data)) {
		data.forEach((entry: unknown) => {
			if (typeof entry === 'object' && entry !== null) {
				const e = entry as Record<string, unknown>;
				const charId = (e.characterId || e.character_id || e.character || e.charId || e.userId || e.user_id) as string | undefined;
				const faction = (e.factionName || e.faction_name || e.faction || e.name || e.title || e.factionId || e.faction_id) as string | undefined;
				const val = getNumericValue(e, ['score', 'value', 'amount', 'points', 'delta', 'reputation', 'count']);

				if (charId && faction && val !== undefined) {
					const charRep = map.get(charId) || {};
					charRep[faction] = val;
					map.set(charId, charRep);
				}
			}
		});
	} else if (typeof data === 'object') {
		Object.entries(data as Record<string, unknown>).forEach(([key1, val1]) => {
			if (typeof val1 === 'object' && val1 !== null) {
				if (Array.isArray(val1)) {
					val1.forEach(item => {
						if (typeof item === 'object' && item !== null) {
							const faction = (item.factionName || item.faction_name || item.faction || item.name) as string | undefined;
							const num = getNumericValue(item as Record<string, unknown>, ['score', 'value', 'amount', 'points', 'delta']);
							if (faction && num !== undefined) {
								const charRep = map.get(key1) || {};
								charRep[faction] = num;
								map.set(key1, charRep);
							}
						}
					});
				} else {
					Object.entries(val1 as Record<string, unknown>).forEach(([key2, val2]) => {
						if (typeof val2 === 'number') {
							const charRep = map.get(key1) || {};
							charRep[key2] = val2;
							map.set(key1, charRep);
						} else if (typeof val2 === 'string' && !isNaN(Number(val2))) {
							const charRep = map.get(key1) || {};
							charRep[key2] = Number(val2);
							map.set(key1, charRep);
						} else if (typeof val2 === 'object' && val2 !== null) {
							const num = getNumericValue(val2 as Record<string, unknown>, ['score', 'value', 'amount', 'points', 'delta']);
							if (num !== undefined) {
								const charRep = map.get(key1) || {};
								charRep[key2] = num;
								map.set(key1, charRep);
							}
						}
					});
				}
			}
		});
	}
}

function getNumericValue(obj: Record<string, unknown>, keys: string[]): number | undefined {
	for (const k of keys) {
		const val = obj[k];
		if (typeof val === 'number') return val;
		if (typeof val === 'string' && !isNaN(Number(val))) return Number(val);
	}
	return undefined;
}
