import { App, Modal, Setting, Notice } from 'obsidian';
import GuildObsidianPlugin from '../main';
import { GuildApiClient, GuildWorld, GuildSession, GuildCharacter, GuildQuest } from '../api';
import { syncSingleSession } from '../sessionSync';
import { syncSingleCharacter } from '../characterSync';
import { syncSingleQuest } from '../questSync';

export class CreateSessionModal extends Modal {
	private plugin: GuildObsidianPlugin;
	private onCreated?: () => void;

	private system: 'PF' | 'DnD' = 'PF';
	private maxPlayers = 5;
	private level?: number;
	private location = '';
	private planning = '';
	private isIntro = false;
	private isPrivate = false;
	private worldId?: string;

	constructor(app: App, plugin: GuildObsidianPlugin, onCreated?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onCreated = onCreated;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: '+ New Session' });

		const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);
		const worlds = await client.getWorlds().catch(() => []);

		if (this.plugin.settings.selectedWorldId && this.plugin.settings.selectedWorldId !== 'ALL') {
			this.worldId = this.plugin.settings.selectedWorldId;
		} else if (worlds.length > 0) {
			this.worldId = worlds[0]._id;
		}

		new Setting(contentEl)
			.setName('Game System')
			.addDropdown(drop => drop
				.addOption('PF', 'Pathfinder (PF)')
				.addOption('DnD', 'D&D 5e')
				.setValue(this.system)
				.onChange(val => {
					this.system = val as 'PF' | 'DnD';
				}));

		new Setting(contentEl)
			.setName('Campaign World')
			.addDropdown(drop => {
				worlds.forEach(w => drop.addOption(w._id, w.name));
				if (this.worldId) drop.setValue(this.worldId);
				drop.onChange(val => {
					this.worldId = val;
				});
			});

		new Setting(contentEl)
			.setName('Max Players')
			.addText(text => text
				.setValue(String(this.maxPlayers))
				.onChange(val => {
					const num = parseInt(val, 10);
					if (!isNaN(num)) this.maxPlayers = num;
				}));

		new Setting(contentEl)
			.setName('Level')
			.setDesc('Party level (optional, defaults automatically if Intro)')
			.addText(text => text
				.setPlaceholder('e.g. 3')
				.onChange(val => {
					const num = parseInt(val, 10);
					this.level = !isNaN(num) ? num : undefined;
				}));

		new Setting(contentEl)
			.setName('Location')
			.addText(text => text
				.setPlaceholder('e.g. Ouroubouros Inn')
				.onChange(val => {
					this.location = val.trim();
				}));

		new Setting(contentEl)
			.setName('Intro Session')
			.setDesc('Flag this session as an introductory session (defaults level automatically).')
			.addToggle(toggle => toggle
				.setValue(this.isIntro)
				.onChange(val => {
					this.isIntro = val;
				}));

		new Setting(contentEl)
			.setName('Private Session')
			.setDesc('Hide session from public viewers unless they attend or are Admin.')
			.addToggle(toggle => toggle
				.setValue(this.isPrivate)
				.onChange(val => {
					this.isPrivate = val;
				}));

		new Setting(contentEl)
			.setName('Planning / Notes')
			.addTextArea(text => text
				.setPlaceholder('Session outline or GM notes...')
				.onChange(val => {
					this.planning = val;
				}));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Create Session')
				.setCta()
				.onClick(async () => {
					if (!this.plugin.settings.apiKey) {
						new Notice('Guild Obsidian: Please set your API key in settings before creating sessions.');
						return;
					}

					btn.setDisabled(true);
					btn.setButtonText('Creating...');

					try {
						const sessionData: Partial<GuildSession> = {
							system: this.system,
							maxPlayers: this.maxPlayers,
							isIntro: this.isIntro,
							isPrivate: this.isPrivate,
							location: this.location || undefined,
							planning: this.planning || undefined,
							worldId: this.worldId || undefined,
							level: this.level
						};

						const created = await client.createSession(sessionData);
						new Notice(`Guild Obsidian: Successfully created session!`);
						await syncSingleSession(this.plugin, created);
						this.close();
						if (this.onCreated) this.onCreated();
					} catch (err: unknown) {
						btn.setDisabled(false);
						btn.setButtonText('Create Session');
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(`Failed to create session: ${msg}`);
					}
				}));
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class CreateCharacterModal extends Modal {
	private plugin: GuildObsidianPlugin;
	private onCreated?: () => void;

	private name = '';
	private system: 'PF' | 'DnD' = 'PF';
	private class = '';
	private ancestry = '';
	private websiteLink = '';

	constructor(app: App, plugin: GuildObsidianPlugin, onCreated?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onCreated = onCreated;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: '+ New Character' });

		new Setting(contentEl)
			.setName('Character Name')
			.addText(text => text
				.setPlaceholder('e.g. Kaelen')
				.onChange(val => {
					this.name = val.trim();
				}));

		new Setting(contentEl)
			.setName('Game System')
			.addDropdown(drop => drop
				.addOption('PF', 'Pathfinder (PF)')
				.addOption('DnD', 'D&D 5e')
				.setValue(this.system)
				.onChange(val => {
					this.system = val as 'PF' | 'DnD';
				}));

		new Setting(contentEl)
			.setName('Class')
			.addText(text => text
				.setPlaceholder('e.g. Fighter')
				.onChange(val => {
					this.class = val.trim();
				}));

		new Setting(contentEl)
			.setName('Ancestry / Race')
			.addText(text => text
				.setPlaceholder('e.g. Human')
				.onChange(val => {
					this.ancestry = val.trim();
				}));

		new Setting(contentEl)
			.setName('Website Link')
			.addText(text => text
				.setPlaceholder('https://...')
				.onChange(val => {
					this.websiteLink = val.trim();
				}));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Create Character')
				.setCta()
				.onClick(async () => {
					if (!this.name) {
						new Notice('Please provide a character name.');
						return;
					}
					if (!this.plugin.settings.apiKey) {
						new Notice('Guild Obsidian: Please set your API key in settings before creating characters.');
						return;
					}

					btn.setDisabled(true);
					btn.setButtonText('Creating...');

					try {
						const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);
						const created = await client.createCharacter({
							name: this.name,
							system: this.system,
							class: this.class || undefined,
							ancestry: this.ancestry || undefined,
							websiteLink: this.websiteLink || undefined
						});

						new Notice(`Guild Obsidian: Successfully created character "${created.name}"!`);
						await syncSingleCharacter(this.plugin, created);
						this.close();
						if (this.onCreated) this.onCreated();
					} catch (err: unknown) {
						btn.setDisabled(false);
						btn.setButtonText('Create Character');
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(`Failed to create character: ${msg}`);
					}
				}));
	}

	onClose() {
		this.contentEl.empty();
	}
}

export class CreateQuestModal extends Modal {
	private plugin: GuildObsidianPlugin;
	private onCreated?: () => void;

	private name = '';
	private description = '';
	private questgiver = '';
	private reward = '';
	private rewardType: 'party' | 'per_person' = 'per_person';
	private rewardMoneyGP?: number;
	private rewardOther = '';
	private levelPF?: number;
	private levelDnD?: number;
	private worldId?: string;

	constructor(app: App, plugin: GuildObsidianPlugin, onCreated?: () => void) {
		super(app);
		this.plugin = plugin;
		this.onCreated = onCreated;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl('h2', { text: '+ New Quest' });

		const client = new GuildApiClient(this.plugin.settings.apiUrl, this.plugin.settings.apiKey);
		const worlds = await client.getWorlds().catch(() => []);

		if (this.plugin.settings.selectedWorldId && this.plugin.settings.selectedWorldId !== 'ALL') {
			this.worldId = this.plugin.settings.selectedWorldId;
		} else if (worlds.length > 0) {
			this.worldId = worlds[0]._id;
		}

		new Setting(contentEl)
			.setName('Quest Name')
			.addText(text => text
				.setPlaceholder('e.g. The Great Escape')
				.onChange(val => {
					this.name = val.trim();
				}));

		new Setting(contentEl)
			.setName('Campaign World')
			.addDropdown(drop => {
				worlds.forEach(w => drop.addOption(w._id, w.name));
				if (this.worldId) drop.setValue(this.worldId);
				drop.onChange(val => {
					this.worldId = val;
				});
			});

		new Setting(contentEl)
			.setName('Questgiver')
			.addText(text => text
				.setPlaceholder('e.g. Guard Captain')
				.onChange(val => {
					this.questgiver = val.trim();
				}));

		new Setting(contentEl)
			.setName('Description')
			.addTextArea(text => text
				.setPlaceholder('Objective and quest description...')
				.onChange(val => {
					this.description = val.trim();
				}));

		new Setting(contentEl)
			.setName('Reward Description')
			.setDesc('Textual reward summary (e.g. "50 GP + Scroll of Invisibility")')
			.addText(text => text
				.setPlaceholder('e.g. 50 GP / person + Scroll')
				.onChange(val => {
					this.reward = val.trim();
				}));

		new Setting(contentEl)
			.setName('Reward Gold (GP)')
			.addText(text => text
				.setPlaceholder('50')
				.onChange(val => {
					const num = parseFloat(val);
					this.rewardMoneyGP = !isNaN(num) ? num : undefined;
				}));

		new Setting(contentEl)
			.setName('Reward Distribution')
			.addDropdown(drop => drop
				.addOption('per_person', 'Per Person (/ person)')
				.addOption('party', 'Entire Party (pooled)')
				.setValue(this.rewardType)
				.onChange(val => {
					this.rewardType = val as 'party' | 'per_person';
				}));

		new Setting(contentEl)
			.setName('Additional Reward / Items')
			.addText(text => text
				.setPlaceholder('e.g. Scroll of Invisibility')
				.onChange(val => {
					this.rewardOther = val.trim();
				}));

		new Setting(contentEl)
			.setName('Level (Pathfinder)')
			.addText(text => text
				.setPlaceholder('e.g. 3')
				.onChange(val => {
					const num = parseInt(val, 10);
					this.levelPF = !isNaN(num) ? num : undefined;
				}));

		new Setting(contentEl)
			.setName('Level (D&D 5e)')
			.addText(text => text
				.setPlaceholder('e.g. 5')
				.onChange(val => {
					const num = parseInt(val, 10);
					this.levelDnD = !isNaN(num) ? num : undefined;
				}));

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText('Create Quest')
				.setCta()
				.onClick(async () => {
					if (!this.name) {
						new Notice('Please provide a quest name.');
						return;
					}
					if (!this.plugin.settings.apiKey) {
						new Notice('Guild Obsidian: Please set your API key in settings before creating quests.');
						return;
					}

					btn.setDisabled(true);
					btn.setButtonText('Creating...');

					try {
						const questData: Partial<GuildQuest> = {
							name: this.name,
							description: this.description || undefined,
							questgiver: this.questgiver || undefined,
							reward: this.reward || undefined,
							rewardType: this.rewardType,
							rewardMoneyGP: this.rewardMoneyGP,
							rewardOther: this.rewardOther || undefined,
							levelPF: this.levelPF,
							levelDnD: this.levelDnD,
							worldId: this.worldId || undefined
						};

						const created = await client.createQuest(questData);
						new Notice(`Guild Obsidian: Successfully created quest "${created.name}"!`);
						await syncSingleQuest(this.plugin, created);
						this.close();
						if (this.onCreated) this.onCreated();
					} catch (err: unknown) {
						btn.setDisabled(false);
						btn.setButtonText('Create Quest');
						const msg = err instanceof Error ? err.message : String(err);
						new Notice(`Failed to create quest: ${msg}`);
					}
				}));
	}

	onClose() {
		this.contentEl.empty();
	}
}
