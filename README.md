# Guild Obsidian Plugin

An official Obsidian plugin for interfacing with **Guild of The Void** (`https://guild.tarragon.be`). Sync campaign sessions, player characters, quests, and world reputation directly into your Obsidian Vault with full Templater compatibility.

---

## 🚀 Installation Instructions

### Option 1: Install from GitHub Release (Recommended)

1. **Download the latest release**:
   Go to the [Releases](https://github.com/Zorth/guild-obsidian/releases) page and download `guild-obsidian-X.X.X.zip` from the latest release.

2. **Locate your Obsidian Vault plugin directory**:
   Open your vault's hidden plugin folder:
   * **Tip**: In Obsidian, go to **Settings → Community plugins**, and click the folder icon next to **Installed plugins** to open the directory directly in your file manager.
   * Path: `<vault>/.obsidian/plugins/`
     * **Linux**: `/path/to/your/vault/.obsidian/plugins/`
     * **macOS**: `/path/to/your/vault/.obsidian/plugins/`
     * **Windows**: `C:\path\to\your\vault\.obsidian\plugins\`

3. **Extract the release files**:
   Create a folder named `guild-obsidian` inside `.obsidian/plugins/` (if it doesn't already exist):
   ```text
   <vault>/.obsidian/plugins/guild-obsidian/
   ```
   Extract the 3 files from the zip into that directory:
   * `main.js`
   * `manifest.json`
   * `styles.css`

4. **Enable the plugin**:
   * In Obsidian, open **Settings → Community plugins**.
   * Turn **Restricted mode** **OFF** if prompted.
   * Click the **Reload plugins** button (refresh icon) or reload Obsidian (`Ctrl + R`).
   * Locate **Guild Obsidian** in the installed plugins list and toggle it **ON**.

---

### Option 2: BRAT Installation (Beta Reviewers Auto-update Tool)

If you use the [Obsidian BRAT plugin](https://github.com/TfTHacker/obsidian-42-brat) for automatic beta updates:

1. Open Obsidian **Settings → BRAT**.
2. Click **Add Beta Plugin**.
3. Enter the repository URL:
   `https://github.com/Zorth/guild-obsidian`
4. Click **Add Plugin**.
5. Enable **Guild Obsidian** in **Settings → Community plugins**.

---

### Option 3: Manual Build from Source (Developers)

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/Zorth/guild-obsidian.git
   cd guild-obsidian
   npm install
   ```

2. Build the plugin:
   ```bash
   npm run build
   ```

3. Symlink or copy `main.js`, `manifest.json`, and `styles.css` into your vault's `.obsidian/plugins/guild-obsidian/` folder:
   ```bash
   ln -s "$(pwd)" /path/to/your/vault/.obsidian/plugins/guild-obsidian
   ```

---

## ⚙️ Configuration & Quick Start

1. Open **Settings → Guild Obsidian**.
2. **API Base URL**: `https://guild.tarragon.be/api/external/v1` (default).
3. **API Key**: Enter your Bearer token (`vg_...`) generated from your Guild profile.
4. Click **Test Connection** to verify API access.

### Features
* **Session Sync**: Sync sessions for a selected campaign world (or all worlds) into notes. Preserves body content and Templater scripts while updating YAML frontmatter.
* **Character Sync & Rank Tags**: Sync player characters and reputation scores into notes. Automatically tags characters based on their Guild rank (e.g. `#character/apprentice`, `#character/journeyman`) with custom patterns and override support.
* **Quests & Campaign Worlds**: Sync active quests with configurable property mappings.
* **Guild Sidebar**: Open the Guild sidebar (`shield` ribbon icon) to browse campaign worlds, quests, player characters, and upcoming sessions. Toggle tab visibility in settings.

---

## 🛠️ Development Scripts

* **Watch mode**: `npm run dev`
* **Production build**: `npm run build`
* **Release version bump**: `npm run version`
