import { TFile, Notice } from 'obsidian';
import GuildObsidianPlugin from './main';
import { GuildApiClient, GuildQuest } from './api';
import { createNoteFromTemplate } from './templateUtils';

export interface QuestSyncResult {
	created: number;
	updated: number;
	total: number;
}

export function getQuestFilePath(plugin: GuildObsidianPlugin, quest: GuildQuest): string {
	const folderPath = plugin.settings.questsFolder.trim().replace(/^\/+|\/+$/g, '') || 'Quests';
	let pattern = plugin.settings.questFilenameFormat.trim() || '{name}';

	pattern = pattern
		.replace('{name}', quest.name)
		.replace('{id}', quest._id)
		.replace('{questgiver}', quest.questgiver || '')
		.replace('{world}', quest.worldId || '');

	const sanitizedFilename = pattern.replace(/[/\\?%*:|"<>]/g, '-').trim();
	const finalFilename = sanitizedFilename.endsWith('.md') ? sanitizedFilename : `${sanitizedFilename}.md`;
	return `${folderPath}/${finalFilename}`;
}

export async function syncSingleQuest(plugin: GuildObsidianPlugin, quest: GuildQuest): Promise<TFile> {
	const filePath = getQuestFilePath(plugin, quest);

	// Ensure Target Folder Exists
	const folderPath = plugin.settings.questsFolder.trim().replace(/^\/+|\/+$/g, '') || 'Quests';
	const folder = plugin.app.vault.getAbstractFileByPath(folderPath);
	if (!folder) {
		await plugin.app.vault.createFolder(folderPath);
	}

	const frontmatterProps: Record<string, unknown> = {};

	if (plugin.settings.questIdPropertyKey) {
		frontmatterProps[plugin.settings.questIdPropertyKey] = quest._id;
	}
	if (plugin.settings.questNamePropertyKey) {
		frontmatterProps[plugin.settings.questNamePropertyKey] = quest.name;
	}
	if (plugin.settings.questDescriptionPropertyKey && quest.description) {
		frontmatterProps[plugin.settings.questDescriptionPropertyKey] = quest.description;
	}
	if (plugin.settings.questRewardPropertyKey && quest.reward) {
		frontmatterProps[plugin.settings.questRewardPropertyKey] = quest.reward;
	}
	if (plugin.settings.questgiverPropertyKey && quest.questgiver) {
		frontmatterProps[plugin.settings.questgiverPropertyKey] = quest.questgiver;
	}
	if (plugin.settings.questStatusPropertyKey) {
		frontmatterProps[plugin.settings.questStatusPropertyKey] = quest.isCompleted || false;
	}
	if (plugin.settings.questWorldPropertyKey && quest.worldId) {
		frontmatterProps[plugin.settings.questWorldPropertyKey] = quest.worldId;
	}

	let existingFile = plugin.app.vault.getAbstractFileByPath(filePath);
	if (!(existingFile instanceof TFile)) {
		// Fallback lookup by quest ID in frontmatter
		const files = plugin.app.vault.getMarkdownFiles();
		const idKey = plugin.settings.questIdPropertyKey || 'guild_quest_id';
		for (const file of files) {
			const cache = plugin.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && cache.frontmatter[idKey] === quest._id) {
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
			plugin.settings.questTemplateFilePath,
			frontmatterProps
		);
	}
}

export async function syncQuests(plugin: GuildObsidianPlugin): Promise<QuestSyncResult> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);
	let quests: GuildQuest[] = [];

	try {
		quests = await client.getQuests(plugin.settings.selectedWorldId);
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Guild Obsidian: Failed to fetch quests: ${msg}`);
		return { created: 0, updated: 0, total: 0 };
	}

	if (quests.length === 0) {
		new Notice('Guild Obsidian: No quests found to sync.');
		return { created: 0, updated: 0, total: 0 };
	}

	let createdCount = 0;
	let updatedCount = 0;

	for (const quest of quests) {
		const filePath = getQuestFilePath(plugin, quest);
		const existingFile = plugin.app.vault.getAbstractFileByPath(filePath);
		if (existingFile instanceof TFile) {
			updatedCount++;
		} else {
			createdCount++;
		}
		await syncSingleQuest(plugin, quest);
	}

	const total = quests.length;
	new Notice(`Guild Obsidian: Quest sync complete. Created: ${createdCount}, Updated: ${updatedCount}, Total: ${total}`);
	return { created: createdCount, updated: updatedCount, total };
}

export async function pushQuest(plugin: GuildObsidianPlugin, questId: string): Promise<boolean> {
	const client = new GuildApiClient(plugin.settings.apiUrl, plugin.settings.apiKey);
	const files = plugin.app.vault.getMarkdownFiles();
	const idKey = plugin.settings.questIdPropertyKey || 'guild_quest_id';

	let targetFile: TFile | null = null;
	for (const file of files) {
		const cache = plugin.app.metadataCache.getFileCache(file);
		if (cache?.frontmatter && cache.frontmatter[idKey] === questId) {
			targetFile = file;
			break;
		}
	}

	if (!targetFile) {
		new Notice('Guild Obsidian: Local quest note not found to push.');
		return false;
	}

	const cache = plugin.app.metadataCache.getFileCache(targetFile);
	const fm = cache?.frontmatter || {};

	const updateData: Partial<GuildQuest> = {};

	const nameKey = plugin.settings.questNamePropertyKey || 'name';
	const descKey = plugin.settings.questDescriptionPropertyKey || 'description';
	const rewardKey = plugin.settings.questRewardPropertyKey || 'reward';
	const statusKey = plugin.settings.questStatusPropertyKey || 'isCompleted';

	if (fm[nameKey] !== undefined) updateData.name = String(fm[nameKey]);
	if (fm[descKey] !== undefined) updateData.description = String(fm[descKey]);
	if (fm[rewardKey] !== undefined) updateData.reward = String(fm[rewardKey]);
	if (fm[statusKey] !== undefined) updateData.isCompleted = Boolean(fm[statusKey]);

	try {
		await client.updateQuest(questId, updateData);
		new Notice(`Guild Obsidian: Successfully pushed quest updates for "${updateData.name || questId}"`);
		return true;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : String(err);
		new Notice(`Guild Obsidian: Failed to push quest: ${msg}`);
		return false;
	}
}
