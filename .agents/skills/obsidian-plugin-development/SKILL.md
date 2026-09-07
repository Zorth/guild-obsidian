---
name: obsidian-plugin-development
description: >-
  Use this skill when developing, building, debugging, or packaging Obsidian plugins using TypeScript, HTML/CSS, and the official Obsidian API.
---

# Obsidian Plugin Development Skill

This skill provides guidelines, best practices, and standard workflows for creating, developing, testing, and releasing Obsidian plugins.

---

## 1. Plugin Architecture & File Structure

A standard Obsidian plugin project contains the following essential files:

```text
guild-obsidian/
├── .agents/                      # Local Antigravity custom rules/skills
├── src/                          # TypeScript source files
│   ├── main.ts                   # Plugin entry point (extends Plugin)
│   ├── settings.ts               # Plugin settings interface & settings tab
│   └── views/                    # Custom views / modals / UI components
├── esbuild.config.mjs            # ESBuild script for bundling into main.js
├── manifest.json                 # Obsidian plugin manifest metadata
├── package.json                  # Dependencies, scripts, and package specs
├── styles.css                    # CSS styling for the plugin
├── tsconfig.json                 # TypeScript compiler configuration
└── versions.json                 # Target minAppVersion mapping for releases
```

---

## 2. Core Obsidian API Patterns

### Plugin Entry Point (`main.ts`)
```typescript
import { Plugin } from 'obsidian';
import { GuildObsidianSettings, DEFAULT_SETTINGS, GuildObsidianSettingTab } from './settings';

export default class GuildObsidianPlugin extends Plugin {
	settings: GuildObsidianSettings;

	async onload() {
		await this.loadSettings();

		// Add status bar item
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Guild Active');

		// Add ribbon icon
		this.addRibbonIcon('dice', 'Guild Obsidian', (evt: MouseEvent) => {
			// Action when ribbon icon is clicked
		});

		// Add command
		this.addCommand({
			id: 'open-guild-view',
			name: 'Open Guild View',
			callback: () => {
				// Command logic
			}
		});

		// Register settings tab
		this.addSettingTab(new GuildObsidianSettingTab(this.app, this));
	}

	onunload() {
		// Clean up resources, event listeners, intervals
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
```

### Settings Tab Pattern
```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import GuildObsidianPlugin from './main';

export interface GuildObsidianSettings {
	mySetting: string;
}

export const DEFAULT_SETTINGS: GuildObsidianSettings = {
	mySetting: 'default'
};

export class GuildObsidianSettingTab extends PluginSettingTab {
	plugin: GuildObsidianPlugin;

	constructor(app: App, plugin: GuildObsidianPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting Name')
			.setDesc('Setting description')
			.addText(text => text
				.setPlaceholder('Enter value')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}
```

---

## 3. Build & Development Workflow

### Useful NPM Scripts
- `npm run dev`: Starts `esbuild` in watch mode (`esbuild.config.mjs production=false`).
- `npm run build`: Performs a production build outputting compiled `main.js`.
- `npm run version`: Updates `manifest.json` and `versions.json` during releases.

### Deploying to an Obsidian Vault for Testing
To test the plugin live in Obsidian:
1. Locate your test vault directory (e.g. `path/to/vault/.obsidian/plugins/guild-obsidian/`).
2. Copy `main.js`, `manifest.json`, and `styles.css` into that directory.
3. Reload Obsidian or reload plugins via **Settings -> Community Plugins**.
