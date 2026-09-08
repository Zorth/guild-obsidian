import { TFile, Notice } from 'obsidian';
import GuildObsidianPlugin from './main';
import { GuildApiClient, GuildCharacter } from './api';
import { createNoteFromTemplate } from './templateUtils';

export interface CharacterSyncResult {
	created: number;
	updated: number;
	total: number;
}

export function getCharacterFilePath(plugin: GuildObsidianPlugin, character: GuildCharacter): string {
	const folderPath = plugin.settings.charactersFolder.trim().replace(/^\/+|\/+$/g, '') || 'Characters';
	let pattern = plugin.settings.characterFilenameFormat.trim() || '{name}';

	const effectiveRank = (!character.rank || character.rank.trim().toLowerCase() === 'none') ? 'Apprentice' : character.rank;

	pattern = pattern
		.replace('{name}', character.name)
		.replace('{title}', character.title || '')
		.replace('{id}', character._id)
		.replace('{lvl}', String(character.lvl))
		.replace('{level}', String(character.lvl))
		.replace('{class}', character.class || '')
		.replace('{ancestry}', character.ancestry || '')
		.replace('{system}', character.system || '')
		.replace('{rank}', effectiveRank);

	const sanitizedFilename = pattern.replace(/[/\\?%*:|"<>]/g, '-').trim();
	const finalFilename = sanitizedFilename.endsWith('.md') ? sanitizedFilename : `${sanitizedFilename}.md`;
	return `${folderPath}/${finalFilename}`;
}

export function getStandardCharacterKeys(plugin: GuildObsidianPlugin): Set<string> {
	return new Set([
		plugin.settings.characterIdPropertyKey,
		plugin.settings.characterNamePropertyKey,
		plugin.settings.characterTitlePropertyKey,
		plugin.settings.characterLevelPropertyKey,
		plugin.settings.characterXpPropertyKey,
		plugin.settings.characterClassPropertyKey,
		plugin.settings.characterAncestryPropertyKey,
		plugin.settings.characterSystemPropertyKey,
		plugin.settings.characterRankPropertyKey,
		plugin.settings.characterWebsiteLinkPropertyKey,
		plugin.settings.characterPlayerPropertyKey,
		plugin.settings.characterReputationPropertyKey,
		'guild_character_id',
		'name',
		'level',
		'lvl',
		'xp',
		'class',
		'ancestry',
		'system',
		'rank',
		'websiteLink',
		'player',
		'userId',
		'tags',
		'aliases',
		'position',
		'reputation'
	]);
}

export async function syncSingleCharacter(
	plugin: GuildObsidianPlugin,
	character: GuildCharacter,
	characterReputationMap?: Map<string, Record<string, number>>
): Promise<TFile> {
	const filePath = getCharacterFilePath(plugin, character);

	const folderPath = plugin.settings.charactersFolder.trim().replace(/^\/+|\/+$/g, '') || 'Characters';
	const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
	if (!folder) {
		await plugin.app.vault.createFolder(folderPath);
	}

	let existingFile = plugin.app.vault.getAbstractFileByPath(filePath);
	if (!(existingFile instanceof TFile)) {
		const files = plugin.app.vault.getMarkdownFiles();
		const idKey = plugin.settings.characterIdPropertyKey || 'guild_character_id';
		for (const file of files) {
			const cache = plugin.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && cache.frontmatter[idKey] === character._id) {
				existingFile = file;
				break;
			}
		}
	}

	const existingFm = (existingFile instanceof TFile)
		? (plugin.app.metadataCache.getFileCache(existingFile)?.frontmatter || {})
		: {};

	const frontmatterProps: Record<string, unknown> = {};

	if (plugin.settings.characterIdPropertyKey) {
		frontmatterProps[plugin.settings.characterIdPropertyKey] = character._id;
	}
	if (plugin.settings.characterNamePropertyKey) {
		frontmatterProps[plugin.settings.characterNamePropertyKey] = character.name;
	}
	if (plugin.settings.characterTitlePropertyKey && character.title) {
		frontmatterProps[plugin.settings.characterTitlePropertyKey] = character.title;
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
	if (plugin.settings.characterRankPropertyKey) {
		const effectiveRank = (!character.rank || character.rank.trim().toLowerCase() === 'none') ? 'Apprentice' : character.rank;
		frontmatterProps[plugin.settings.characterRankPropertyKey] = effectiveRank;
	}
	if (plugin.settings.characterWebsiteLinkPropertyKey && character.websiteLink) {
		frontmatterProps[plugin.settings.characterWebsiteLinkPropertyKey] = character.websiteLink;
	}

	const playerName = extractPlayerName(character);
	const playerKey = plugin.settings.characterPlayerPropertyKey || 'player';
	if (playerName) {
		frontmatterProps[playerKey] = playerName;
	}

	// If characterReputationMap wasn't provided (e.g. single character sync / refresh), fetch world reputation
	if (!characterReputationMap) {
		characterReputationMap = new Map<string, Record<string, number>>();
		const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);
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
				// ignore
			}
		}
	}

	const standardKeys = getStandardCharacterKeys(plugin);
	const repFromChar = extractCharacterReputation(character);
	const repFromMap = characterReputationMap?.get(character._id) || {};
	const mergedRep: Record<string, number | undefined> = { ...repFromChar, ...repFromMap };

	const knownFactions = new Set<string>();
	knownFactions.add('Rep');
	knownFactions.add('Kill');

	if (characterReputationMap) {
		for (const reps of characterReputationMap.values()) {
			for (const f of Object.keys(reps)) {
				if (f) knownFactions.add(f);
			}
		}
	}
	for (const f of Object.keys(repFromChar)) {
		if (f) knownFactions.add(f);
	}
	for (const f of Object.keys(repFromMap)) {
		if (f) knownFactions.add(f);
	}
	for (const [key, val] of Object.entries(existingFm)) {
		if (!standardKeys.has(key)) {
			const num = typeof val === 'number' ? val : Number(val);
			if (!isNaN(num)) {
				knownFactions.add(key);
			}
		}
	}

	for (const faction of knownFactions) {
		const fetchedVal = mergedRep[faction];
		const noteValRaw = existingFm[faction];
		const noteValNum = typeof noteValRaw === 'number'
			? noteValRaw
			: (typeof noteValRaw === 'string' && noteValRaw.trim() !== '' && !isNaN(Number(noteValRaw)) ? Number(noteValRaw) : undefined);

		if (fetchedVal !== undefined && typeof fetchedVal === 'number') {
			frontmatterProps[faction] = fetchedVal;
		} else {
			// Reputation value is not set when fetching
			if (noteValNum !== undefined && noteValNum !== 0) {
				// Value already exists in note and is not 0: keep it and try to push to guild
				frontmatterProps[faction] = noteValNum;

				try {
					let targetWorldId = (character as any).worldId || (character as any).world_id || (typeof (character as any).world === 'string' ? (character as any).world : (character as any).world?._id);
					if (!targetWorldId && plugin.settings.selectedWorldId && plugin.settings.selectedWorldId !== 'ALL') {
						targetWorldId = plugin.settings.selectedWorldId;
					}
					if (!targetWorldId) {
						const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);
						const worlds = await client.getWorlds().catch(() => []);
						targetWorldId = worlds[0]?._id;
					}
					if (targetWorldId && plugin.settings.apiKey) {
						const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);
						await client.updateReputation(targetWorldId, character._id, faction, noteValNum);
					}
				} catch (err) {
					console.warn(`Guild Obsidian: Failed to push reputation ${faction} for ${character.name}:`, err);
				}
			} else {
				// Fall back to 0 if not set
				frontmatterProps[faction] = 0;
			}
		}
	}

	if (existingFile instanceof TFile) {
		await plugin.app.fileManager.processFrontMatter(existingFile, (fm) => {
			delete fm.userId;
			Object.assign(fm, frontmatterProps);
		});
		return existingFile;
	} else {
		return await createNoteFromTemplate(
			plugin.app,
			filePath,
			plugin.settings.characterTemplateFilePath,
			frontmatterProps
		);
	}
}

export async function pushCharacter(plugin: GuildObsidianPlugin, characterId: string): Promise<boolean> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);
	const files = plugin.app.vault.getMarkdownFiles();
	const idKey = plugin.settings.characterIdPropertyKey || 'guild_character_id';

	let targetFile: TFile | null = null;
	for (const file of files) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		if (cache?.frontmatter && cache.frontmatter[idKey] === characterId) {
			targetFile = file;
			break;
		}
	}

	if (!targetFile) {
		new Notice('Guild Obsidian: Local character note not found to push.');
		return false;
	}

	const cache = plugin.app.metadataCache.getFileCache(targetFile);
	const fm = cache?.frontmatter || {};

	const updateData: Partial<GuildCharacter> = {};

	const nameKey = plugin.settings.characterNamePropertyKey || 'name';
	const titleKey = plugin.settings.characterTitlePropertyKey || 'title';
	const classKey = plugin.settings.characterClassPropertyKey || 'class';
	const ancestryKey = plugin.settings.characterAncestryPropertyKey || 'ancestry';
	const websiteKey = plugin.settings.characterWebsiteLinkPropertyKey || 'websiteLink';

	if (fm[nameKey] !== undefined) updateData.name = String(fm[nameKey]);
	if (fm[titleKey] !== undefined) updateData.title = String(fm[titleKey]);
	if (fm[classKey] !== undefined) updateData.class = String(fm[classKey]);
	if (fm[ancestryKey] !== undefined) updateData.ancestry = String(fm[ancestryKey]);
	if (fm[websiteKey] !== undefined) updateData.websiteLink = String(fm[websiteKey]);

	try {
		await client.updateCharacter(characterId, updateData);

		// Also push reputation values found in note frontmatter
		const standardKeys = getStandardCharacterKeys(plugin);
		let targetWorldId = (fm.worldId || fm.world_id || plugin.settings.selectedWorldId) as string | undefined;
		if (targetWorldId === 'ALL') targetWorldId = undefined;
		if (!targetWorldId) {
			const worlds = await client.getWorlds().catch(() => []);
			targetWorldId = worlds[0]?._id;
		}

		if (targetWorldId) {
			for (const [key, val] of Object.entries(fm)) {
				if (!standardKeys.has(key)) {
					const num = typeof val === 'number' ? val : Number(val);
					if (!isNaN(num)) {
						try {
							await client.updateReputation(targetWorldId, characterId, key, num);
						} catch (repErr) {
							console.warn(`Guild Obsidian: Failed to push reputation ${key}:`, repErr);
						}
					}
				}
			}
		}

		new Notice(`Guild Obsidian: Successfully pushed character updates for "${updateData.name || characterId}"`);
		return true;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Guild Obsidian: Failed to push character: ${msg}`);
		return false;
	}
}

export async function syncCharacters(plugin: GuildObsidianPlugin): Promise<CharacterSyncResult> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);

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

	let createdCount = 0;
	let updatedCount = 0;

	for (const character of characters) {
		await syncSingleCharacter(plugin, character, characterReputationMap);
		updatedCount++;
	}

	const total = characters.length;
	new Notice(`Guild Obsidian: Character sync complete. Total: ${total}`);
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

function extractPlayerName(character: GuildCharacter): string | undefined {
	const c = character as Record<string, unknown>;
	const candidates = [
		c.player,
		c.playerName,
		c.player_name,
		c.userName,
		c.user_name,
		c.username,
		c.user,
		c.ownerName,
		c.owner,
		c.displayName,
		c.display_name,
	];

	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate.trim()) {
			const str = candidate.trim();
			// Exclude raw 24-char hex Mongo ObjectIDs
			if (!/^[0-9a-fA-F]{24}$/.test(str)) {
				return str;
			}
		}
		if (typeof candidate === 'object' && candidate !== null) {
			const obj = candidate as Record<string, unknown>;
			const name = (obj.name || obj.username || obj.displayName || obj.user_name || obj.playerName || obj.global_name || obj.nick) as string | undefined;
			if (typeof name === 'string' && name.trim() && !/^[0-9a-fA-F]{24}$/.test(name.trim())) {
				return name.trim();
			}
		}
	}

	// Deep check all properties of character object in case nested user object has another key name
	for (const [key, val] of Object.entries(c)) {
		if (['name', '_id', 'id', 'system', 'ancestry', 'class', 'rank', 'websiteLink', 'lvl', 'xp'].includes(key)) continue;
		if (typeof val === 'object' && val !== null) {
			const obj = val as Record<string, unknown>;
			const name = (obj.name || obj.username || obj.displayName || obj.user_name || obj.playerName || obj.global_name || obj.nick) as string | undefined;
			if (typeof name === 'string' && name.trim() && !/^[0-9a-fA-F]{24}$/.test(name.trim())) {
				return name.trim();
			}
		}
	}

	return undefined;
}
