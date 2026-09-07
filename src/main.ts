import { Notice, Plugin, WorkspaceLeaf } from 'obsidian';
import { GuildObsidianSettings, DEFAULT_SETTINGS, GuildObsidianSettingTab } from './settings';
import { GuildView, GUILD_VIEW_TYPE } from './views/GuildView';
import { GuildApiClient } from './api';
import { syncSessions } from './sessionSync';

export default class GuildObsidianPlugin extends Plugin {
	settings: GuildObsidianSettings;

	async onload() {
		await this.loadSettings();

		// Register View
		this.registerView(
			GUILD_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new GuildView(leaf, this)
		);

		// Add Ribbon Icon to open Guild View
		this.addRibbonIcon('shield', 'Guild of The Void', () => {
			this.activateGuildView();
		});

		// Status bar indicator
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.addClass('guild-obsidian-status-bar');
		statusBarItemEl.setText('Guild: Connected');

		// Commands
		this.addCommand({
			id: 'open-guild-sidebar',
			name: 'Open Guild Sidebar',
			callback: () => {
				this.activateGuildView();
			}
		});

		this.addCommand({
			id: 'guild-sync-sessions',
			name: 'Sync Session Notes',
			callback: async () => {
				await syncSessions(this);
			}
		});

		this.addCommand({
			id: 'guild-test-connection',
			name: 'Test API Connection',
			callback: async () => {
				try {
					const client = new GuildApiClient(this.settings.apiUrl, this.settings.apiKey);
					const worlds = await client.getWorlds();
					new Notice(`Guild API Connected! Found ${worlds.length} campaign worlds.`);
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					new Notice(`Guild API Connection Failed: ${msg}`);
				}
			}
		});

		// Settings Tab
		this.addSettingTab(new GuildObsidianSettingTab(this.app, this));

		console.log('Guild Obsidian plugin loaded');
	}

	onunload() {
		console.log('Guild Obsidian plugin unloaded');
	}

	async activateGuildView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(GUILD_VIEW_TYPE);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) {
				await leaf.setViewState({ type: GUILD_VIEW_TYPE, active: true });
			}
		}

		if (leaf) {
			workspace.revealLeaf(leaf);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
