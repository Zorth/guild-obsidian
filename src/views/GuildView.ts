import { ItemView, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import GuildObsidianPlugin from '../main';
import { GuildApiClient, GuildWorld, GuildQuest, GuildCharacter, GuildSession } from '../api';
import { syncSessions, syncSingleSession, pushSession, getSessionFilePath } from '../sessionSync';
import { syncCharacters, syncSingleCharacter, pushCharacter, getCharacterFilePath } from '../characterSync';
import { syncQuests, syncSingleQuest, pushQuest, getQuestFilePath } from '../questSync';
import { CreateSessionModal, CreateCharacterModal, CreateQuestModal } from './GuildModals';

export const GUILD_VIEW_TYPE = 'guild-sidebar-view';

export class GuildView extends ItemView {
	plugin: GuildObsidianPlugin;
	private activeTab: 'sessions' | 'characters' | 'worlds' = 'sessions';

	// Filters
	private sessionSystemFilter: 'ALL' | 'PF' | 'DnD' = 'ALL';
	private sessionIntroFilter = false;
	private characterSystemFilter: 'ALL' | 'PF' | 'DnD' = 'ALL';
	private characterSearchQuery = '';
	private questFilterStatus: 'all' | 'active' | 'completed' = 'all';

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

		// Navigation Tabs
		const nav = container.createEl('div', { cls: 'guild-nav-tabs' });
		const allTabs: Array<{ id: 'sessions' | 'characters' | 'worlds'; label: string }> = [
			{ id: 'sessions', label: 'Sessions' },
			{ id: 'characters', label: 'Characters' },
			{ id: 'worlds', label: worldsTabLabel }
		];
		const tabs = allTabs.filter(tab => {
			if (tab.id === 'sessions') return this.plugin.settings.enableSessions;
			if (tab.id === 'characters') return this.plugin.settings.enableCharacters;
			if (tab.id === 'worlds') return this.plugin.settings.enableWorlds ?? this.plugin.settings.enableQuests;
			return true;
		});

		if (tabs.length === 0) {
			const emptyMsg = container.createEl('div', { cls: 'guild-card-list' });
			emptyMsg.createEl('p', { text: 'All tabs are disabled in plugin settings.', cls: 'guild-card-empty' });
			return;
		}

		// Ensure activeTab is valid
		if (!tabs.some(t => t.id === this.activeTab)) {
			this.activeTab = tabs[0].id;
		}

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
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			content.createEl('div', { cls: 'guild-error', text: `Failed to load data: ${msg}` });
		}
	}

	private async renderSessions(container: HTMLElement, client: GuildApiClient) {
		// Action Bar: Sync button and + New Session button
		const actionBar = container.createEl('div', { cls: 'guild-action-bar' });

		const syncBtn = actionBar.createEl('button', { text: '🔄 Sync All Sessions', cls: 'guild-sync-btn' });
		syncBtn.addEventListener('click', async () => {
			await syncSessions(this.plugin);
			await this.render();
		});

		const newBtn = actionBar.createEl('button', { text: '+ New Session', cls: 'guild-new-btn' });
		newBtn.addEventListener('click', () => {
			new CreateSessionModal(this.app, this.plugin, () => this.render()).open();
		});

		// Filter Bar: System filter & Intro filter
		const filterBar = container.createEl('div', { cls: 'guild-filter-bar' });

		const sysOptions: Array<{ key: 'ALL' | 'PF' | 'DnD'; label: string }> = [
			{ key: 'ALL', label: 'All' },
			{ key: 'PF', label: 'PF' },
			{ key: 'DnD', label: 'D&D' }
		];
		sysOptions.forEach(opt => {
			const btn = filterBar.createEl('button', {
				text: opt.label,
				cls: `guild-filter-btn ${this.sessionSystemFilter === opt.key ? 'guild-filter-active' : ''}`
			});
			btn.addEventListener('click', () => {
				this.sessionSystemFilter = opt.key;
				this.render();
			});
		});

		const introBtn = filterBar.createEl('button', {
			text: this.sessionIntroFilter ? 'Intro Only' : 'All Sessions',
			cls: `guild-filter-btn ${this.sessionIntroFilter ? 'guild-filter-active' : ''}`
		});
		introBtn.addEventListener('click', () => {
			this.sessionIntroFilter = !this.sessionIntroFilter;
			this.render();
		});

		// Fetch Upcoming and Past Sessions
		const upcomingSessions = await client.getSessions(
			false,
			this.plugin.settings.selectedWorldId,
			this.sessionSystemFilter === 'ALL' ? undefined : this.sessionSystemFilter,
			this.sessionIntroFilter ? true : undefined
		).catch(() => []);

		const pastSessions = await client.getSessions(
			true,
			this.plugin.settings.selectedWorldId,
			this.sessionSystemFilter === 'ALL' ? undefined : this.sessionSystemFilter,
			this.sessionIntroFilter ? true : undefined
		).catch(() => []);

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
		const header = card.createEl('div', { cls: 'guild-card-header' });
		const levelInfo = session.level !== undefined ? ` (Lvl ${session.level})` : '';
		header.createEl('strong', { text: `System: ${session.system}${levelInfo} - Max Players: ${session.maxPlayers}` });

		if (session.isIntro) {
			header.createEl('span', { text: ' [Intro]', cls: 'guild-badge-intro' });
		}
		if (session.locked) {
			header.createEl('span', { text: ' 🔒', cls: 'guild-badge-locked' });
		}

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
		// Action Bar: Sync button and + New Character button
		const actionBar = container.createEl('div', { cls: 'guild-action-bar' });

		const syncBtn = actionBar.createEl('button', { text: '🔄 Sync All Characters', cls: 'guild-sync-btn' });
		syncBtn.addEventListener('click', async () => {
			await syncCharacters(this.plugin);
			await this.render();
		});

		const newBtn = actionBar.createEl('button', { text: '+ New Character', cls: 'guild-new-btn' });
		newBtn.addEventListener('click', () => {
			new CreateCharacterModal(this.app, this.plugin, () => this.render()).open();
		});

		// Filter Bar: System filter & Search box
		const filterBar = container.createEl('div', { cls: 'guild-filter-bar' });

		const sysOptions: Array<{ key: 'ALL' | 'PF' | 'DnD'; label: string }> = [
			{ key: 'ALL', label: 'All' },
			{ key: 'PF', label: 'PF' },
			{ key: 'DnD', label: 'D&D' }
		];
		sysOptions.forEach(opt => {
			const btn = filterBar.createEl('button', {
				text: opt.label,
				cls: `guild-filter-btn ${this.characterSystemFilter === opt.key ? 'guild-filter-active' : ''}`
			});
			btn.addEventListener('click', () => {
				this.characterSystemFilter = opt.key;
				this.render();
			});
		});

		const searchInput = filterBar.createEl('input', {
			cls: 'guild-search-input',
			type: 'text',
			placeholder: 'Filter by name or player...'
		});
		searchInput.value = this.characterSearchQuery;
		searchInput.addEventListener('input', () => {
			this.characterSearchQuery = searchInput.value;
			this.filterAndRenderCharacterList(charListContainer, allCharacters);
		});

		let allCharacters = await client.getCharacters();
		// Sort characters descending by level, then by XP
		allCharacters.sort((a, b) => {
			const lvlDiff = (b.lvl || 0) - (a.lvl || 0);
			if (lvlDiff !== 0) return lvlDiff;
			return (b.xp || 0) - (a.xp || 0);
		});

		const charListContainer = container.createEl('div');
		this.filterAndRenderCharacterList(charListContainer, allCharacters);
	}

	private filterAndRenderCharacterList(container: HTMLElement, characters: GuildCharacter[]) {
		container.empty();

		let filtered = characters;
		if (this.characterSystemFilter !== 'ALL') {
			filtered = filtered.filter(c => (c.system || '').toLowerCase() === this.characterSystemFilter.toLowerCase());
		}
		if (this.characterSearchQuery.trim()) {
			const q = this.characterSearchQuery.toLowerCase().trim();
			filtered = filtered.filter(c => {
				const name = (c.name || '').toLowerCase();
				const player = (typeof c.player === 'string' ? c.player : c.player?.name || '').toLowerCase();
				const cls = (c.class || '').toLowerCase();
				return name.includes(q) || player.includes(q) || cls.includes(q);
			});
		}

		container.createEl('h5', { text: `Characters (${filtered.length})` });
		const charList = container.createEl('div', { cls: 'guild-card-list' });

		if (filtered.length === 0) {
			charList.createEl('p', { text: 'No characters match the filter.', cls: 'guild-card-empty' });
			return;
		}

		filtered.forEach(c => {
			const card = charList.createEl('div', { cls: 'guild-card' });
			const titleSuffix = c.title ? ` - "${c.title}"` : '';
			card.createEl('strong', { text: `${c.name}${titleSuffix} (Lvl ${c.lvl} ${c.class || ''})` });
			const playerInfo = c.player ? ` | Player: ${typeof c.player === 'string' ? c.player : (c.player?.name || '')}` : '';
			if (c.ancestry || c.xp !== undefined) {
				card.createEl('p', { text: `Ancestry: ${c.ancestry || 'N/A'} | XP: ${c.xp}${playerInfo}` });
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
					const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);
					const fullChar = await client.getCharacter(c._id).catch(() => c);
					await syncSingleCharacter(this.plugin, fullChar);
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
					const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);
					const fullChar = await client.getCharacter(c._id).catch(() => c);
					await syncSingleCharacter(this.plugin, fullChar);
					await this.render();
				});
			}
		});
	}

	private async renderWorldsAndQuests(container: HTMLElement, client: GuildApiClient, isWorldSelected: boolean) {
		// Action Bar: Sync button and + New Quest button
		const actionBar = container.createEl('div', { cls: 'guild-action-bar' });

		const syncBtn = actionBar.createEl('button', { text: '🔄 Sync All Quests', cls: 'guild-sync-btn' });
		syncBtn.addEventListener('click', async () => {
			await syncQuests(this.plugin);
			await this.render();
		});

		const newBtn = actionBar.createEl('button', { text: '+ New Quest', cls: 'guild-new-btn' });
		newBtn.addEventListener('click', () => {
			new CreateQuestModal(this.app, this.plugin, () => this.render()).open();
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
		const activeQuests = quests.filter(q => !q.isCompleted);
		const completedQuests = quests.filter(q => q.isCompleted);

		// Filter Bar: All / Active / Completed
		const filterBar = container.createEl('div', { cls: 'guild-filter-bar' });

		const statusFilters: Array<{ key: 'all' | 'active' | 'completed'; label: string }> = [
			{ key: 'all', label: `All (${quests.length})` },
			{ key: 'active', label: `Active (${activeQuests.length})` },
			{ key: 'completed', label: `Completed (${completedQuests.length})` }
		];

		statusFilters.forEach(opt => {
			const btn = filterBar.createEl('button', {
				text: opt.label,
				cls: `guild-filter-btn ${this.questFilterStatus === opt.key ? 'guild-filter-active' : ''}`
			});
			btn.addEventListener('click', () => {
				this.questFilterStatus = opt.key;
				this.render();
			});
		});

		// Section 1: Active Quests
		if (this.questFilterStatus === 'all' || this.questFilterStatus === 'active') {
			container.createEl('h5', { text: `Active Quests (${activeQuests.length})` });
			const activeList = container.createEl('div', { cls: 'guild-card-list' });

			if (activeQuests.length === 0) {
				activeList.createEl('p', { text: 'No active quests found.', cls: 'guild-card-empty' });
			} else {
				activeQuests.forEach(q => this.renderQuestCard(activeList, q));
			}
		}

		// Section 2: Completed Quests in their own section
		if (this.questFilterStatus === 'all' || this.questFilterStatus === 'completed') {
			container.createEl('h5', { text: `Completed Quests (${completedQuests.length})` });
			const completedList = container.createEl('div', { cls: 'guild-card-list' });

			if (completedQuests.length === 0) {
				completedList.createEl('p', { text: 'No completed quests found.', cls: 'guild-card-empty' });
			} else {
				completedQuests.forEach(q => this.renderQuestCard(completedList, q));
			}
		}
	}

	private renderQuestCard(container: HTMLElement, q: GuildQuest) {
		const card = container.createEl('div', { cls: 'guild-card' });
		const header = card.createEl('div', { cls: 'guild-card-header' });
		header.createEl('strong', { text: q.name });

		if (q.isCompleted) {
			header.createEl('span', { text: ' (Completed)', cls: 'guild-badge-completed' });
		}

		if (q.description) card.createEl('p', { text: q.description });

		let rewardText = q.reward;
		if (!rewardText && (q.rewardMoneyGP !== undefined || q.rewardOther)) {
			const parts: string[] = [];
			if (q.rewardMoneyGP !== undefined) parts.push(`${q.rewardMoneyGP} GP${q.rewardType === 'per_person' ? ' / person' : ''}`);
			if (q.rewardOther) parts.push(q.rewardOther);
			rewardText = parts.join(' + ');
		}
		if (rewardText) card.createEl('small', { text: `Reward: ${rewardText}` });

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
