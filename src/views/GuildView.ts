import { ItemView, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import GuildObsidianPlugin from '../main';
import { GuildApiClient, GuildWorld, GuildQuest, GuildCharacter, GuildSession } from '../api';
import { syncSessions, syncSingleSession, pushSession, getSessionFilePath } from '../sessionSync';
import { syncCharacters, syncSingleCharacter, pushCharacter, getCharacterFilePath } from '../characterSync';
import { syncQuests, syncSingleQuest, pushQuest, getQuestFilePath } from '../questSync';

export const GUILD_VIEW_TYPE = 'guild-sidebar-view';

export class GuildView extends ItemView {
	plugin: GuildObsidianPlugin;
	private activeTab: 'sessions' | 'characters' | 'worlds' | 'market' = 'sessions';

	constructor(leaf: WorkspaceLeaf, plugin: GuildObsidianPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return GUILD_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Guild of The Void';
	}

	getIcon(): string {
		return 'shield';
	}

	async onOpen() {
		await this.render();
	}

	async render() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass('guild-view-container');

		// Header
		const header = container.createEl('div', { cls: 'guild-header' });
		header.createEl('h4', { text: 'Guild of The Void' });

		const refreshBtn = header.createEl('button', { text: '🔄 Refresh' });
		refreshBtn.addEventListener('click', () => this.render());

		// Dynamic Tab Label for Worlds/Quests based on selectedWorldId
		const isWorldSelected = Boolean(
			this.plugin.settings.selectedWorldId && this.plugin.settings.selectedWorldId !== 'ALL'
		);
		const worldsTabLabel = isWorldSelected ? 'Quests' : 'Worlds & Quests';

		// Navigation Tabs: Sessions main tab first
		const nav = container.createEl('div', { cls: 'guild-nav-tabs' });
		const tabs: Array<{ id: 'sessions' | 'characters' | 'worlds' | 'market'; label: string }> = [
			{ id: 'sessions', label: 'Sessions' },
			{ id: 'characters', label: 'Characters' },
			{ id: 'worlds', label: worldsTabLabel },
			{ id: 'market', label: 'Black Void' }
		];

		tabs.forEach(tab => {
			const btn = nav.createEl('button', {
				text: tab.label,
				cls: this.activeTab === tab.id ? 'guild-tab-active' : ''
			});
			btn.addEventListener('click', () => {
				this.activeTab = tab.id;
				this.render();
			});
		});

		// Content Area
		const content = container.createEl('div', { cls: 'guild-tab-content' });
		const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);

		try {
			if (this.activeTab === 'sessions') {
				await this.renderSessions(content, client);
			} else if (this.activeTab === 'characters') {
				await this.renderCharacters(content, client);
			} else if (this.activeTab === 'worlds') {
				await this.renderWorldsAndQuests(content, client, isWorldSelected);
			} else if (this.activeTab === 'market') {
				await this.renderMarket(content, client);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			content.createEl('div', { cls: 'guild-error', text: `Failed to load data: ${msg}` });
		}
	}

	private async renderSessions(container: HTMLElement, client: GuildApiClient) {
		const syncBtn = container.createEl('button', { text: '🔄 Sync All Session Notes to Vault', cls: 'guild-sync-btn' });
		syncBtn.addEventListener('click', async () => {
			await syncSessions(this.plugin);
			await this.render();
		});

		// Fetch Upcoming and Past Sessions
		const upcomingSessions = await client.getSessions(false, this.plugin.settings.selectedWorldId).catch(() => []);
		const pastSessions = await client.getSessions(true, this.plugin.settings.selectedWorldId).catch(() => []);

		// Section 1: Upcoming Sessions
		container.createEl('h5', { text: `Upcoming Sessions (${upcomingSessions.length})` });
		const upcomingList = container.createEl('div', { cls: 'guild-card-list' });

		if (upcomingSessions.length === 0) {
			upcomingList.createEl('p', { text: 'No upcoming sessions found.', cls: 'guild-card-empty' });
		} else {
			upcomingSessions.forEach(s => this.renderSessionCard(upcomingList, s));
		}

		// Section 2: Past Sessions
		container.createEl('h5', { text: `Past Sessions (${pastSessions.length})` });
		const pastList = container.createEl('div', { cls: 'guild-card-list' });

		if (pastSessions.length === 0) {
			pastList.createEl('p', { text: 'No past sessions found.', cls: 'guild-card-empty' });
		} else {
			pastSessions.forEach(s => this.renderSessionCard(pastList, s));
		}
	}

	private renderSessionCard(container: HTMLElement, session: GuildSession) {
		const card = container.createEl('div', { cls: 'guild-card' });
		card.createEl('strong', { text: `System: ${session.system} (Max Players: ${session.maxPlayers})` });

		const rawDate = session.date || session.startDate;
		if (rawDate) {
			const d = new Date(rawDate);
			const formatted = !isNaN(d.getTime()) ? d.toLocaleString() : String(rawDate);
			card.createEl('p', { text: `Date: ${formatted}` });
		}
		if (session.location) {
			card.createEl('small', { text: `Location: ${session.location}` });
		}

		const existingFile = this.findFileForSession(session);
		const actions = card.createEl('div', { cls: 'guild-card-actions' });

		if (existingFile instanceof TFile) {
			const gotoBtn = actions.createEl('button', { text: '📄 Go to Note', cls: 'guild-goto-btn' });
			gotoBtn.addEventListener('click', () => {
				this.app.workspace.getLeaf(false).openFile(existingFile);
			});

			const refetchBtn = actions.createEl('button', { text: '🔄', cls: 'guild-icon-btn' });
			refetchBtn.title = 'Re-fetch single session from Guild API';
			refetchBtn.addEventListener('click', async () => {
				await syncSingleSession(this.plugin, session);
				new Notice(`Guild Obsidian: Re-fetched session note`);
				await this.render();
			});

			const pushBtn = actions.createEl('button', { text: '⬆️ Push', cls: 'guild-push-btn' });
			pushBtn.title = 'Push local frontmatter changes to Guild API';
			pushBtn.addEventListener('click', async () => {
				await pushSession(this.plugin, session._id);
			});
		} else {
			const importBtn = actions.createEl('button', { text: '📥 Import Note to Vault', cls: 'guild-import-btn' });
			importBtn.addEventListener('click', async () => {
				await syncSingleSession(this.plugin, session);
				await this.render();
			});
		}
	}

	private async renderCharacters(container: HTMLElement, client: GuildApiClient) {
		const syncBtn = container.createEl('button', { text: '🔄 Sync All Characters to Vault', cls: 'guild-sync-btn' });
		syncBtn.addEventListener('click', async () => {
			await syncCharacters(this.plugin);
			await this.render();
		});

		let characters = await client.getCharacters();
		// Sort characters descending by level, then by XP
		characters.sort((a, b) => {
			const lvlDiff = (b.lvl || 0) - (a.lvl || 0);
			if (lvlDiff !== 0) return lvlDiff;
			return (b.xp || 0) - (a.xp || 0);
		});

		container.createEl('h5', { text: `Characters (${characters.length})` });
		const charList = container.createEl('div', { cls: 'guild-card-list' });

		characters.forEach(c => {
			const card = charList.createEl('div', { cls: 'guild-card' });
			card.createEl('strong', { text: `${c.name} (Lvl ${c.lvl} ${c.class || ''})` });
			if (c.ancestry || c.xp !== undefined) {
				card.createEl('p', { text: `Ancestry: ${c.ancestry || 'N/A'} | XP: ${c.xp}` });
			}
			const displayRank = (c.rank && c.rank.trim().toLowerCase() !== 'none') ? c.rank : 'Apprentice';
			card.createEl('small', { text: `Rank: ${displayRank}` });

			const existingFile = this.findFileForCharacter(c);
			const actions = card.createEl('div', { cls: 'guild-card-actions' });

			if (existingFile instanceof TFile) {
				const gotoBtn = actions.createEl('button', { text: '📄 Go to Note', cls: 'guild-goto-btn' });
				gotoBtn.addEventListener('click', () => {
					this.app.workspace.getLeaf(false).openFile(existingFile);
				});

				const refetchBtn = actions.createEl('button', { text: '🔄', cls: 'guild-icon-btn' });
				refetchBtn.title = 'Re-fetch single character from Guild API';
				refetchBtn.addEventListener('click', async () => {
					await syncSingleCharacter(this.plugin, c);
					new Notice(`Guild Obsidian: Re-fetched character note`);
					await this.render();
				});

				const pushBtn = actions.createEl('button', { text: '⬆️ Push', cls: 'guild-push-btn' });
				pushBtn.title = 'Push local frontmatter changes to Guild API';
				pushBtn.addEventListener('click', async () => {
					await pushCharacter(this.plugin, c._id);
				});
			} else {
				const importBtn = actions.createEl('button', { text: '📥 Import Note to Vault', cls: 'guild-import-btn' });
				importBtn.addEventListener('click', async () => {
					await syncSingleCharacter(this.plugin, c);
					await this.render();
				});
			}
		});
	}

	private async renderWorldsAndQuests(container: HTMLElement, client: GuildApiClient, isWorldSelected: boolean) {
		const syncBtn = container.createEl('button', { text: '🔄 Sync All Quests to Vault', cls: 'guild-sync-btn' });
		syncBtn.addEventListener('click', async () => {
			await syncQuests(this.plugin);
			await this.render();
		});

		// Only fetch/display worlds list if no specific world is selected
		if (!isWorldSelected) {
			const worlds = await client.getWorlds().catch(() => []);
			container.createEl('h5', { text: `Campaign Worlds (${worlds.length})` });
			const worldsList = container.createEl('div', { cls: 'guild-card-list' });

			worlds.forEach(w => {
				const card = worldsList.createEl('div', { cls: 'guild-card' });
				card.createEl('strong', { text: w.name });
				if (w.description) card.createEl('p', { text: w.description });
			});
		}

		// Fetch Quests
		const quests = await client.getQuests(this.plugin.settings.selectedWorldId).catch(() => []);
		container.createEl('h5', { text: `Active Quests (${quests.length})` });
		const questList = container.createEl('div', { cls: 'guild-card-list' });

		quests.forEach(q => {
			const card = questList.createEl('div', { cls: 'guild-card' });
			const header = card.createEl('div', { cls: 'guild-card-header' });
			header.createEl('strong', { text: q.name });

			if (q.isCompleted) {
				header.createEl('span', { text: ' (Completed)', cls: 'guild-badge-completed' });
			}

			if (q.description) card.createEl('p', { text: q.description });
			if (q.reward) card.createEl('small', { text: `Reward: ${q.reward}` });

			const existingFile = this.findFileForQuest(q);
			const actions = card.createEl('div', { cls: 'guild-card-actions' });

			if (existingFile instanceof TFile) {
				const gotoBtn = actions.createEl('button', { text: '📄 Go to Note', cls: 'guild-goto-btn' });
				gotoBtn.addEventListener('click', () => {
					this.app.workspace.getLeaf(false).openFile(existingFile);
				});

				const refetchBtn = actions.createEl('button', { text: '🔄', cls: 'guild-icon-btn' });
				refetchBtn.title = 'Re-fetch single quest from Guild API';
				refetchBtn.addEventListener('click', async () => {
					await syncSingleQuest(this.plugin, q);
					new Notice(`Guild Obsidian: Re-fetched quest note`);
					await this.render();
				});

				const pushBtn = actions.createEl('button', { text: '⬆️ Push', cls: 'guild-push-btn' });
				pushBtn.title = 'Push local frontmatter changes to Guild API';
				pushBtn.addEventListener('click', async () => {
					await pushQuest(this.plugin, q._id);
				});
			} else {
				const importBtn = actions.createEl('button', { text: '📥 Import Note to Vault', cls: 'guild-import-btn' });
				importBtn.addEventListener('click', async () => {
					await syncSingleQuest(this.plugin, q);
					await this.render();
				});
			}
		});
	}

	private async renderMarket(container: HTMLElement, client: GuildApiClient) {
		const listings = await client.getListings('item', 'active').catch(() => []);
		container.createEl('h5', { text: `The Black Void - Active Listings (${listings.length})` });

		const list = container.createEl('div', { cls: 'guild-card-list' });
		listings.forEach(item => {
			const card = list.createEl('div', { cls: 'guild-card' });
			card.createEl('strong', { text: item.name });
			if (item.buyoutPrice) card.createEl('p', { text: `Buyout: ${item.buyoutPrice} gp | Starting Bid: ${item.startingBid || '-'} gp` });
			if (item.sellerName) card.createEl('small', { text: `Seller: ${item.sellerName}` });
		});
	}

	private findFileForSession(session: GuildSession): TFile | null {
		const filePath = getSessionFilePath(this.plugin, session);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) return file;

		const idKey = this.plugin.settings.sessionIdPropertyKey || 'guild_session_id';
		for (const f of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(f);
			if (cache?.frontmatter && cache.frontmatter[idKey] === session._id) {
				return f;
			}
		}
		return null;
	}

	private findFileForCharacter(character: GuildCharacter): TFile | null {
		const filePath = getCharacterFilePath(this.plugin, character);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) return file;

		const idKey = this.plugin.settings.characterIdPropertyKey || 'guild_character_id';
		for (const f of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(f);
			if (cache?.frontmatter && cache.frontmatter[idKey] === character._id) {
				return f;
			}
		}
		return null;
	}

	private findFileForQuest(quest: GuildQuest): TFile | null {
		const filePath = getQuestFilePath(this.plugin, quest);
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) return file;

		const idKey = this.plugin.settings.questIdPropertyKey || 'guild_quest_id';
		for (const f of this.app.vault.getMarkdownFiles()) {
			const cache = this.app.metadataCache.getFileCache(f);
			if (cache?.frontmatter && cache.frontmatter[idKey] === quest._id) {
				return f;
			}
		}
		return null;
	}

	async onClose() {
		// Clean up
	}
}
