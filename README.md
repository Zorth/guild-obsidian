# Guild Obsidian Plugin

An official Obsidian plugin for interfacing with **Guild of The Void** (`https://guild.tarragon.be`). Sync campaign sessions, player characters, quests, world reputation, and market listings directly into your Obsidian Vault with full Templater compatibility.

---

## 🚀 Installation Instructions

### Option 1: Manual Installation (Recommended for Local Testing)

1. **Build the plugin**:
   ```bash
   npm install
   npm run build
   ```
   This will generate the compiled `main.js` file.

2. **Locate your Obsidian Vault plugin directory**:
   In your Obsidian vault, navigate to the hidden `.obsidian/plugins/` directory:
   - **Linux**: `/path/to/your/vault/.obsidian/plugins/`
   - **macOS**: `/path/to/your/vault/.obsidian/plugins/`
   - **Windows**: `C:\path\to\your\vault\.obsidian\plugins\`

3. **Create the plugin folder**:
   Create a directory named `guild-obsidian`:
   ```bash
   mkdir -p /path/to/your/vault/.obsidian/plugins/guild-obsidian
   ```

4. **Copy release files**:
   Copy the following 3 files into `/path/to/your/vault/.obsidian/plugins/guild-obsidian/`:
   - `main.js`
   - `manifest.json`
   - `styles.css`

5. **Enable the plugin in Obsidian**:
   - Open Obsidian.
   - Go to **Settings -> Community plugins**.
   - Make sure **Restricted mode** is turned **OFF**.
   - Click **Reload plugins** or restart Obsidian.
   - Find **Guild Obsidian** in the Installed Plugins list and toggle it **ON**.

---

### Option 2: BRAT Installation (Beta Reviewers Auto-update Tool)

If you use the [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian-42-brat):

1. Open Obsidian **Settings -> BRAT**.
2. Click **Add Beta Plugin**.
3. Enter the repository URL:
   `https://github.com/Zorth/guild-obsidian`
4. Click **Add Plugin**.
5. Enable **Guild Obsidian** in **Settings -> Community plugins**.

---

### Option 3: Developer Symlink Setup

For active plugin development, symlink this repository directory directly into your test vault's plugin directory:

```bash
ln -s /home/zorth/Projects/guild-obsidian /path/to/your/vault/.obsidian/plugins/guild-obsidian
```

Then run development watch mode:
```bash
npm run dev
```

---

## ⚙️ Configuration & Quick Start

1. Open **Settings -> Guild Obsidian**.
2. **API Base URL**: `https://guild.tarragon.be/api/external/v1` (default).
3. **API Key**: Enter your Bearer token (`vg_...`) generated from your Guild profile.
4. Click **Test Connection** to verify API access.

### Features
- **Session Sync**: Sync sessions for a selected campaign world (or all worlds) into notes. Preserves body content and Templater scripts while updating YAML frontmatter.
- **Character Sync**: Sync player characters and world reputation scores into character notes with custom frontmatter property mappings.
- **Guild Sidebar**: Open the Guild sidebar (`shield` ribbon icon) to browse campaign worlds, active quests, player characters, upcoming sessions, and market listings.

---

## 🛠️ Development

- **Watch mode**: `npm run dev`
- **Production build**: `npm run build`
- **Release version bump**: `npm run version`
