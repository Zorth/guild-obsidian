import { App, TFile } from 'obsidian';

/**
 * Detects whether the Templater plugin ('templater-obsidian') is installed and enabled.
 */
export function getTemplater(app: App): any | null {
	const plugins = (app as any).plugins;
	if (!plugins) return null;
	const templaterPlugin = typeof plugins.getPlugin === 'function'
		? plugins.getPlugin('templater-obsidian')
		: plugins.plugins?.['templater-obsidian'];

	if (templaterPlugin && templaterPlugin.templater) {
		return templaterPlugin.templater;
	}
	return null;
}

/**
 * Creates a new note and applies a template.
 * If Templater plugin is detected, Templater's execution engine parses and processes the template.
 * Fallback to reading raw template content if Templater is not installed or enabled.
 * Applies frontmatter properties after creation.
 */
export async function createNoteFromTemplate(
	app: App,
	filePath: string,
	templatePath: string,
	frontmatterProps: Record<string, unknown>
): Promise<TFile> {
	const templateFile = templatePath.trim()
		? app.vault.getAbstractFileByPath(templatePath.trim())
		: null;

	const targetTemplate = templateFile instanceof TFile ? templateFile : null;
	const templater = getTemplater(app);

	let newFile: TFile;

	if (targetTemplate && templater && typeof templater.write_template_to_file === 'function') {
		// Create empty target note first
		newFile = await app.vault.create(filePath, '');

		try {
			// Execute Templater to render template content into new file
			await templater.write_template_to_file(targetTemplate, newFile);
		} catch (err) {
			console.warn('Guild Obsidian: Templater execution failed, falling back to static template copy:', err);
			const content = await app.vault.read(targetTemplate);
			await app.vault.modify(newFile, content);
		}
	} else if (targetTemplate) {
		// Static template copy if Templater is not active
		const content = await app.vault.read(targetTemplate);
		newFile = await app.vault.create(filePath, content);
	} else {
		// No template specified
		newFile = await app.vault.create(filePath, '');
	}

	// Populate / update frontmatter properties
	await app.fileManager.processFrontMatter(newFile, (fm) => {
		Object.assign(fm, frontmatterProps);
	});

	return newFile;
}
