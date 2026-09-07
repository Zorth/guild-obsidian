import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import GuildObsidianPlugin from './main';
import { GuildApiClient, GuildWorld } from './api';
import { syncSessions } from './sessionSync';

export interface GuildObsidianSettings {
	apiUrl: string;
	apiKey: string;

	// Session Sync Settings
	selectedWorldId: string;
	sessionsFolder: string;
	filenameFormat: string;
	templateFilePath: string;

	// Configurable Property Keys
	playersPropertyKey: string;
	startDatePropertyKey: string;
	endDatePropertyKey: string;
	sessionIdPropertyKey: string;
	worldPropertyKey: string;
	systemPropertyKey: string;
}

export const DEFAULT_SETTINGS: GuildObsidianSettings = {
	apiUrl: 'https://guild.tarragon.be/api/external/v1',
	apiKey: '',

	selectedWorldId: 'ALL',
	sessionsFolder: 'Sessions',
	filenameFormat: '{date} {world}',
	templateFilePath: '',

	playersPropertyKey: 'players',
	startDatePropertyKey: 'startDate',
	endDatePropertyKey: 'endDate',
	sessionIdPropertyKey: 'guild_session_id',
	worldPropertyKey: 'world',
	systemPropertyKey: 'system'
};

export class GuildObsidianSettingTab extends PluginSettingTab {
	plugin: GuildObsidianPlugin;

	constructor(app: App, plugin: GuildObsidianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'Guild of The Void - Settings' });

		// --- Connection Settings ---
		containerEl.createEl('h3', { text: 'API Connection' });

		new Setting(containerEl)
			.setName('API Base URL')
			.setDesc('The base endpoint URL for the Guild external API.')
			.addText(text => text
				.setPlaceholder('https://guild.tarragon.be/api/external/v1')
				.setValue(this.plugin.settings.apiUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API Key')
			.setDesc('Your Bearer token (e.g. vg_your_api_key).')
			.addText(text => {
				text.inputEl.type = 'password';
				text.setPlaceholder('vg_...')
					.setValue(this.plugin.settings.apiKey)
					.onChange(async (value) => {
						this.plugin.settings.apiKey = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Verify connection to the API endpoint.')
			.addButton(button => button
				.setButtonText('Test Connection')
				.setCta()
				.onClick(async () => {
					try {
						const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);
						const worlds = await client.getWorlds();
						new Notice(`Connection Successful! Found ${worlds.length} campaign worlds.`);
					} catch (err: unknown) {
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(`Connection Failed: ${msg}`);
					}
				}));

		// --- Session Sync Settings ---
		containerEl.createEl('h3', { text: 'Session Synchronization Settings' });

		// World Selection Dropdown
		const worldSetting = new Setting(containerEl)
			.setName('Select Campaign World')
			.setDesc('Select a world to sync sessions for, or select ALL to sync sessions across all campaign worlds.');

		// Fetch worlds for dropdown
		let worlds: GuildWorld[] = [];
		try {
			const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);
			worlds = await client.getWorlds();
		} catch {
			// API not connected or offline
		}

		worldSetting.addDropdown(dropdown => {
			dropdown.addOption('ALL', 'All Worlds (ALL)');
			worlds.forEach(w => dropdown.addOption(w._id, w.name));
			dropdown.setValue(this.plugin.settings.selectedWorldId || 'ALL');
			dropdown.onChange(async (value) => {
				this.plugin.settings.selectedWorldId = value;
				await this.plugin.saveSettings();
			});
		});

		new Setting(containerEl)
			.setName('Sessions Folder')
			.setDesc('Vault folder where session notes will be created/updated.')
			.addText(text => text
				.setPlaceholder('Sessions')
				.setValue(this.plugin.settings.sessionsFolder)
				.onChange(async (value) => {
					this.plugin.settings.sessionsFolder = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Filename Format')
			.setDesc('Pattern for session note filenames. Placeholders: {date} (or YYYY-MM-DD), {world} (or WORLDNAME), {system}, {id}.')
			.addText(text => text
				.setPlaceholder('{date} {world}')
				.setValue(this.plugin.settings.filenameFormat)
				.onChange(async (value) => {
					this.plugin.settings.filenameFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Session Template Note')
			.setDesc('Path to template file (e.g. Templates/Session Template.md). Used for newly created notes. Templater compatible.')
			.addText(text => text
				.setPlaceholder('Templates/Session Template.md')
				.setValue(this.plugin.settings.templateFilePath)
				.onChange(async (value) => {
					this.plugin.settings.templateFilePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sync Sessions Now')
			.setDesc('Fetch sessions from Guild API and update/create local session notes in your vault.')
			.addButton(button => button
				.setButtonText('🔄 Refresh / Sync Sessions')
				.setCta()
				.onClick(async () => {
					await syncSessions(this.plugin);
				}));

		// --- Configurable Property Keys ---
		containerEl.createEl('h3', { text: 'Configurable Frontmatter Property Keys' });
		containerEl.createEl('p', { text: 'Customize the frontmatter property names written to session notes.', cls: 'setting-item-description' });

		new Setting(containerEl)
			.setName('Players Field Key')
			.setDesc('Property name for attending players list (formatted as wikilinks).')
			.addText(text => text
				.setPlaceholder('players')
				.setValue(this.plugin.settings.playersPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.playersPropertyKey = value.trim() || 'players';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Start Date Field Key')
			.setDesc('Property name for session start date / calendar date.')
			.addText(text => text
				.setPlaceholder('startDate')
				.setValue(this.plugin.settings.startDatePropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.startDatePropertyKey = value.trim() || 'startDate';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('End Date Field Key')
			.setDesc('Property name for session end date.')
			.addText(text => text
				.setPlaceholder('endDate')
				.setValue(this.plugin.settings.endDatePropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.endDatePropertyKey = value.trim() || 'endDate';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Session ID Field Key')
			.setDesc('Property name for Guild Session ID.')
			.addText(text => text
				.setPlaceholder('guild_session_id')
				.setValue(this.plugin.settings.sessionIdPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.sessionIdPropertyKey = value.trim() || 'guild_session_id';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('World Field Key')
			.setDesc('Property name for Campaign World.')
			.addText(text => text
				.setPlaceholder('world')
				.setValue(this.plugin.settings.worldPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.worldPropertyKey = value.trim() || 'world';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('System Field Key')
			.setDesc('Property name for Game System (PF / DnD).')
			.addText(text => text
				.setPlaceholder('system')
				.setValue(this.plugin.settings.systemPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.systemPropertyKey = value.trim() || 'system';
					await this.plugin.saveSettings();
				}));
	}
}
