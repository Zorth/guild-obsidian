import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import GuildObsidianPlugin from './main';
import { GuildApiClient, GuildWorld } from './api';
import { syncSessions } from './sessionSync';
import { syncCharacters } from './characterSync';
import { FolderSuggest, FileSuggest } from './suggest';

export interface GuildObsidianSettings {
	apiUrl: string;
	apiKey: string;

	// Campaign World
	selectedWorldId: string;

	// Session Sync Settings
	sessionsFolder: string;
	filenameFormat: string;
	templateFilePath: string;

	// Configurable Session Property Keys
	playersPropertyKey: string;
	startDatePropertyKey: string;
	endDatePropertyKey: string;
	sessionIdPropertyKey: string;
	worldPropertyKey: string;
	systemPropertyKey: string;

	// Character Sync Settings
	charactersFolder: string;
	characterFilenameFormat: string;
	characterTemplateFilePath: string;

	// Configurable Character Property Keys
	characterIdPropertyKey: string;
	characterNamePropertyKey: string;
	characterLevelPropertyKey: string;
	characterXpPropertyKey: string;
	characterClassPropertyKey: string;
	characterAncestryPropertyKey: string;
	characterSystemPropertyKey: string;
	characterRankPropertyKey: string;
	characterWebsiteLinkPropertyKey: string;
	characterPlayerPropertyKey: string;
	characterReputationPropertyKey: string;

	// Quest Sync Settings
	questsFolder: string;
	questFilenameFormat: string;
	questTemplateFilePath: string;

	// Configurable Quest Property Keys
	questIdPropertyKey: string;
	questNamePropertyKey: string;
	questDescriptionPropertyKey: string;
	questRewardPropertyKey: string;
	questgiverPropertyKey: string;
	questStatusPropertyKey: string;
	questWorldPropertyKey: string;
}

export const DEFAULT_SETTINGS: GuildObsidianSettings = {
	apiUrl: 'https://guild.tarragon.be/api/external/v1',
	apiKey: '',

	selectedWorldId: 'ALL',

	// Sessions
	sessionsFolder: 'Sessions',
	filenameFormat: '{date} {world}',
	templateFilePath: '',

	playersPropertyKey: 'players',
	startDatePropertyKey: 'startDate',
	endDatePropertyKey: 'endDate',
	sessionIdPropertyKey: 'guild_session_id',
	worldPropertyKey: 'world',
	systemPropertyKey: 'system',

	// Characters
	charactersFolder: 'Characters',
	characterFilenameFormat: '{name}',
	characterTemplateFilePath: '',

	characterIdPropertyKey: 'guild_character_id',
	characterNamePropertyKey: 'name',
	characterLevelPropertyKey: 'level',
	characterXpPropertyKey: 'xp',
	characterClassPropertyKey: 'class',
	characterAncestryPropertyKey: 'ancestry',
	characterSystemPropertyKey: 'system',
	characterRankPropertyKey: 'rank',
	characterWebsiteLinkPropertyKey: 'websiteLink',
	characterPlayerPropertyKey: 'player',
	characterReputationPropertyKey: 'reputation',

	// Quests
	questsFolder: 'Quests',
	questFilenameFormat: '{name}',
	questTemplateFilePath: '',

	questIdPropertyKey: 'guild_quest_id',
	questNamePropertyKey: 'name',
	questDescriptionPropertyKey: 'description',
	questRewardPropertyKey: 'reward',
	questgiverPropertyKey: 'questgiver',
	questStatusPropertyKey: 'isCompleted',
	questWorldPropertyKey: 'world'
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

		// --- Campaign World Selection ---
		containerEl.createEl('h3', { text: 'Campaign World' });

		const worldSetting = new Setting(containerEl)
			.setName('Select Campaign World')
			.setDesc('Select a campaign world for session and reputation synchronization, or ALL for all worlds.');

		let worlds: GuildWorld[] = [];
		try {
			const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);
			worlds = await client.getWorlds();
		} catch {
			// API offline or not set
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

		// --- Session Sync Settings ---
		containerEl.createEl('h3', { text: 'Session Synchronization Settings' });

		new Setting(containerEl)
			.setName('Sessions Folder')
			.setDesc('Vault folder where session notes will be created/updated.')
			.addText(text => {
				text
					.setPlaceholder('Sessions')
					.setValue(this.plugin.settings.sessionsFolder)
					.onChange(async (value) => {
						this.plugin.settings.sessionsFolder = value;
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName('Session Filename Format')
			.setDesc('Pattern for session note filenames. Placeholders: {date}, {world}, {system}, {id}.')
			.addText(text => text
				.setPlaceholder('{date} {world}')
				.setValue(this.plugin.settings.filenameFormat)
				.onChange(async (value) => {
					this.plugin.settings.filenameFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Session Template Note')
			.setDesc('Path to template file for new session notes (e.g. Templates/Session Template.md).')
			.addText(text => {
				text
					.setPlaceholder('Templates/Session Template.md')
					.setValue(this.plugin.settings.templateFilePath)
					.onChange(async (value) => {
						this.plugin.settings.templateFilePath = value;
						await this.plugin.saveSettings();
					});
				new FileSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName('Sync Sessions Now')
			.setDesc('Fetch sessions from Guild API and update/create local session notes.')
			.addButton(button => button
				.setButtonText('🔄 Sync Sessions')
				.setCta()
				.onClick(async () => {
					await syncSessions(this.plugin);
				}));

		// Configurable Session Frontmatter Property Keys
		containerEl.createEl('h4', { text: 'Session Property Mappings' });

		new Setting(containerEl)
			.setName('Players Field Key')
			.setDesc('Property for attending players (wikilinks).')
			.addText(text => text
				.setPlaceholder('players')
				.setValue(this.plugin.settings.playersPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.playersPropertyKey = value.trim() || 'players';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Start Date Field Key')
			.setDesc('Property for session start date / calendar date.')
			.addText(text => text
				.setPlaceholder('startDate')
				.setValue(this.plugin.settings.startDatePropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.startDatePropertyKey = value.trim() || 'startDate';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('End Date Field Key')
			.setDesc('Property for session end date.')
			.addText(text => text
				.setPlaceholder('endDate')
				.setValue(this.plugin.settings.endDatePropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.endDatePropertyKey = value.trim() || 'endDate';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Session ID Field Key')
			.setDesc('Property for Guild Session ID.')
			.addText(text => text
				.setPlaceholder('guild_session_id')
				.setValue(this.plugin.settings.sessionIdPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.sessionIdPropertyKey = value.trim() || 'guild_session_id';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('World Field Key')
			.setDesc('Property for Campaign World.')
			.addText(text => text
				.setPlaceholder('world')
				.setValue(this.plugin.settings.worldPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.worldPropertyKey = value.trim() || 'world';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('System Field Key')
			.setDesc('Property for Game System.')
			.addText(text => text
				.setPlaceholder('system')
				.setValue(this.plugin.settings.systemPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.systemPropertyKey = value.trim() || 'system';
					await this.plugin.saveSettings();
				}));

		// --- Character Sync Settings ---
		containerEl.createEl('h3', { text: 'Character Synchronization Settings' });

		new Setting(containerEl)
			.setName('Characters Folder')
			.setDesc('Vault folder where character notes will be created/updated.')
			.addText(text => {
				text
					.setPlaceholder('Characters')
					.setValue(this.plugin.settings.charactersFolder)
					.onChange(async (value) => {
						this.plugin.settings.charactersFolder = value;
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName('Character Filename Format')
			.setDesc('Pattern for character note filenames. Placeholders: {name}, {id}, {lvl}, {class}, {ancestry}, {system}, {rank}.')
			.addText(text => text
				.setPlaceholder('{name}')
				.setValue(this.plugin.settings.characterFilenameFormat)
				.onChange(async (value) => {
					this.plugin.settings.characterFilenameFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Character Template Note')
			.setDesc('Path to template file for new character notes (e.g. Templates/Character Template.md).')
			.addText(text => {
				text
					.setPlaceholder('Templates/Character Template.md')
					.setValue(this.plugin.settings.characterTemplateFilePath)
					.onChange(async (value) => {
						this.plugin.settings.characterTemplateFilePath = value;
						await this.plugin.saveSettings();
					});
				new FileSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName('Sync Characters Now')
			.setDesc('Fetch characters & world reputation from Guild API and update/create local character notes.')
			.addButton(button => button
				.setButtonText('🔄 Sync Characters')
				.setCta()
				.onClick(async () => {
					await syncCharacters(this.plugin);
				}));

		// Configurable Character Frontmatter Property Keys
		containerEl.createEl('h4', { text: 'Character Property Mappings' });

		new Setting(containerEl)
			.setName('Character ID Field Key')
			.setDesc('Property for Guild Character ID.')
			.addText(text => text
				.setPlaceholder('guild_character_id')
				.setValue(this.plugin.settings.characterIdPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterIdPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Name Field Key')
			.setDesc('Property for Character Name.')
			.addText(text => text
				.setPlaceholder('name')
				.setValue(this.plugin.settings.characterNamePropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterNamePropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Level Field Key')
			.setDesc('Property for Character Level.')
			.addText(text => text
				.setPlaceholder('level')
				.setValue(this.plugin.settings.characterLevelPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterLevelPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('XP Field Key')
			.setDesc('Property for Character Experience Points.')
			.addText(text => text
				.setPlaceholder('xp')
				.setValue(this.plugin.settings.characterXpPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterXpPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Class Field Key')
			.setDesc('Property for Character Class.')
			.addText(text => text
				.setPlaceholder('class')
				.setValue(this.plugin.settings.characterClassPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterClassPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Ancestry Field Key')
			.setDesc('Property for Character Ancestry.')
			.addText(text => text
				.setPlaceholder('ancestry')
				.setValue(this.plugin.settings.characterAncestryPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterAncestryPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('System Field Key')
			.setDesc('Property for Game System.')
			.addText(text => text
				.setPlaceholder('system')
				.setValue(this.plugin.settings.characterSystemPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterSystemPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Rank Field Key')
			.setDesc('Property for Guild Rank.')
			.addText(text => text
				.setPlaceholder('rank')
				.setValue(this.plugin.settings.characterRankPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterRankPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Website Link Field Key')
			.setDesc('Property for Character Website URL.')
			.addText(text => text
				.setPlaceholder('websiteLink')
				.setValue(this.plugin.settings.characterWebsiteLinkPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterWebsiteLinkPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Player Field Key')
			.setDesc('Property for Player / User Name.')
			.addText(text => text
				.setPlaceholder('player')
				.setValue(this.plugin.settings.characterPlayerPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterPlayerPropertyKey = value.trim() || 'player';
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Reputation Field Key')
			.setDesc('Property for World Faction Reputation Scores object.')
			.addText(text => text
				.setPlaceholder('reputation')
				.setValue(this.plugin.settings.characterReputationPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.characterReputationPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		// --- Quest Sync Settings ---
		containerEl.createEl('h3', { text: 'Quest Synchronization Settings' });

		new Setting(containerEl)
			.setName('Quests Folder')
			.setDesc('Vault folder where quest notes will be created/updated.')
			.addText(text => {
				text
					.setPlaceholder('Quests')
					.setValue(this.plugin.settings.questsFolder)
					.onChange(async (value) => {
						this.plugin.settings.questsFolder = value;
						await this.plugin.saveSettings();
					});
				new FolderSuggest(this.app, text.inputEl);
			});

		new Setting(containerEl)
			.setName('Quest Filename Format')
			.setDesc('Pattern for quest note filenames. Placeholders: {name}, {id}, {questgiver}, {world}.')
			.addText(text => text
				.setPlaceholder('{name}')
				.setValue(this.plugin.settings.questFilenameFormat)
				.onChange(async (value) => {
					this.plugin.settings.questFilenameFormat = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Quest Template Note')
			.setDesc('Path to template file for new quest notes (e.g. Templates/Quest Template.md).')
			.addText(text => {
				text
					.setPlaceholder('Templates/Quest Template.md')
					.setValue(this.plugin.settings.questTemplateFilePath)
					.onChange(async (value) => {
						this.plugin.settings.questTemplateFilePath = value;
						await this.plugin.saveSettings();
					});
				new FileSuggest(this.app, text.inputEl);
			});

		// Configurable Quest Frontmatter Property Keys
		containerEl.createEl('h4', { text: 'Quest Property Mappings' });

		new Setting(containerEl)
			.setName('Quest ID Field Key')
			.setDesc('Property for Guild Quest ID.')
			.addText(text => text
				.setPlaceholder('guild_quest_id')
				.setValue(this.plugin.settings.questIdPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.questIdPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Quest Name Field Key')
			.setDesc('Property for Quest Name.')
			.addText(text => text
				.setPlaceholder('name')
				.setValue(this.plugin.settings.questNamePropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.questNamePropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Description Field Key')
			.setDesc('Property for Quest Description.')
			.addText(text => text
				.setPlaceholder('description')
				.setValue(this.plugin.settings.questDescriptionPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.questDescriptionPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Reward Field Key')
			.setDesc('Property for Quest Reward.')
			.addText(text => text
				.setPlaceholder('reward')
				.setValue(this.plugin.settings.questRewardPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.questRewardPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Questgiver Field Key')
			.setDesc('Property for Questgiver.')
			.addText(text => text
				.setPlaceholder('questgiver')
				.setValue(this.plugin.settings.questgiverPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.questgiverPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Status / Completed Field Key')
			.setDesc('Property for Quest Completion Status.')
			.addText(text => text
				.setPlaceholder('isCompleted')
				.setValue(this.plugin.settings.questStatusPropertyKey)
				.onChange(async (value) => {
					this.plugin.settings.questStatusPropertyKey = value.trim();
					await this.plugin.saveSettings();
				}));
	}
}
