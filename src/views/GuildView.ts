import { ItemView, WorkspaceLeaf, Notice, TFile } from 'obsidian';
import GuildObsidianPlugin from '../main';
import { GuildApiClient, GuildWorld, GuildQuest, GuildCharacter, GuildSession, GuildBlackVoidListing } from '../api';
import { syncSessions } from '../sessionSync';

export const GUILD_VIEW_TYPE = 'guild-sidebar-view';

export class GuildView extends ItemView {
	plugin: GuildObsidianPlugin;
	private activeTab: 'worlds' | 'characters' | 'sessions' | 'market' = 'worlds';

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

		// Navigation Tabs
		const nav = container.createEl('div', { cls: 'guild-nav-tabs' });
		
		const tabs: Array<{ id: 'worlds' | 'characters' | 'sessions' | 'market'; label: string }> = [
			{ id: 'worlds', label: 'Worlds & Quests' },
			{ id: 'characters', label: 'Characters' },
			{ id: 'sessions', label: 'Sessions' },
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
			if (this.activeTab === 'worlds') {
				await this.renderWorldsAndQuests(content, client);
			} else if (this.activeTab === 'characters') {
				await this.renderCharacters(content, client);
			} else if (this.activeTab === 'sessions') {
				await this.renderSessions(content, client);
			} else if (this.activeTab === 'market') {
				await this.renderMarket(content, client);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			content.createEl('div', { cls: 'guild-error', text: `Failed to load data: ${msg}` });
		}
	}

	private async renderWorldsAndQuests(container: HTMLElement, client: GuildApiClient) {
		const worlds = await client.getWorlds();
		const quests = await client.getQuests();

		container.createEl('h5', { text: `Campaign Worlds (${worlds.length})` });
		const worldsList = container.createEl('div', { cls: 'guild-card-list' });

		worlds.forEach(w => {
			const card = worldsList.createEl('div', { cls: 'guild-card' });
			card.createEl('strong', { text: w.name });
			if (w.description) card.createEl('p', { text: w.description });
		});

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

			const importBtn = card.createEl('button', { text: '📥 Import Note to Vault', cls: 'guild-import-btn' });
			importBtn.addEventListener('click', async () => {
				await this.importQuestNote(q);
			});
		});
	}

	private async renderCharacters(container: HTMLElement, client: GuildApiClient) {
		const characters = await client.getCharacters();
		container.createEl('h5', { text: `Characters (${characters.length})` });

		const charList = container.createEl('div', { cls: 'guild-card-list' });
		characters.forEach(c => {
			const card = charList.createEl('div', { cls: 'guild-card' });
			card.createEl('strong', { text: `${c.name} (Lvl ${c.lvl} ${c.class || ''})` });
			if (c.ancestry) card.createEl('p', { text: `Ancestry: ${c.ancestry} | XP: ${c.xp}` });

			const importBtn = card.createEl('button', { text: '📥 Import Note to Vault', cls: 'guild-import-btn' });
			importBtn.addEventListener('click', async () => {
				await this.importCharacterNote(c);
			});
		});
	}

	private async renderSessions(container: HTMLElement, client: GuildApiClient) {
		const syncBtn = container.createEl('button', { text: '🔄 Sync Session Notes to Vault', cls: 'guild-sync-btn' });
		syncBtn.addEventListener('click', async () => {
			await syncSessions(this.plugin);
		});

		const sessions = await client.getSessions(false, this.plugin.settings.selectedWorldId);
		container.createEl('h5', { text: `Upcoming Sessions (${sessions.length})` });

		const sessionList = container.createEl('div', { cls: 'guild-card-list' });
		sessions.forEach(s => {
			const card = sessionList.createEl('div', { cls: 'guild-card' });
			card.createEl('strong', { text: `System: ${s.system} (Max Players: ${s.maxPlayers})` });
			if (s.date || s.startDate) card.createEl('p', { text: `Date: ${new Date(s.date || s.startDate || '').toLocaleString()}` });
			if (s.location) card.createEl('small', { text: `Location: ${s.location}` });
		});
	}

	private async renderMarket(container: HTMLElement, client: GuildApiClient) {
		const listings = await client.getListings('item', 'active');
		container.createEl('h5', { text: `The Black Void - Active Listings (${listings.length})` });

		const list = container.createEl('div', { cls: 'guild-card-list' });
		listings.forEach(item => {
			const card = list.createEl('div', { cls: 'guild-card' });
			card.createEl('strong', { text: item.name });
			if (item.buyoutPrice) card.createEl('p', { text: `Buyout: ${item.buyoutPrice} gp | Starting Bid: ${item.startingBid || '-'} gp` });
			if (item.sellerName) card.createEl('small', { text: `Seller: ${item.sellerName}` });
		});
	}

	private async importQuestNote(quest: GuildQuest) {
		const filename = `Quest - ${quest.name.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
		const content = `---
guild_id: "${quest._id}"
type: quest
world_id: "${quest.worldId || ''}"
is_completed: ${quest.isCompleted || false}
---

# Quest: ${quest.name}

**Questgiver**: ${quest.questgiver || 'Unknown'}
**Reward**: ${quest.reward || 'None'}
**Level PF**: ${quest.levelPF || 'N/A'} | **Level DnD**: ${quest.levelDnD || 'N/A'}

## Description
${quest.description || 'No description provided.'}
`;

		await this.saveNote(filename, content);
	}

	private async importCharacterNote(character: GuildCharacter) {
		const filename = `Character - ${character.name.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
		const content = `---
guild_id: "${character._id}"
type: character
level: ${character.lvl}
xp: ${character.xp}
class: "${character.class || ''}"
ancestry: "${character.ancestry || ''}"
---

# Character: ${character.name}

**Level**: ${character.lvl}
**XP**: ${character.xp}
**Class**: ${character.class || 'N/A'}
**Ancestry**: ${character.ancestry || 'N/A'}
**Rank**: ${character.rank || 'N/A'}

${character.websiteLink ? `[View on Guild](${character.websiteLink})` : ''}
`;

		await this.saveNote(filename, content);
	}

	private async saveNote(filename: string, content: string) {
		const file = this.app.vault.getAbstractFileByPath(filename);
		if (file instanceof TFile) {
			await this.app.vault.modify(file, content);
			new Notice(`Updated note: ${filename}`);
		} else {
			await this.app.vault.create(filename, content);
			new Notice(`Created note: ${filename}`);
		}
	}

	async onClose() {
		// Clean up
	}
}
