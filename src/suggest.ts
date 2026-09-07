import { AbstractInputSuggest, App, TFile, TFolder } from 'obsidian';

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(query: string): TFolder[] {
		const lowerQuery = query.toLowerCase().trim();
		const folders = this.app.vault
			.getAllLoadedFiles()
			.filter((f): f is TFolder => f instanceof TFolder && !f.isRoot());

		if (!lowerQuery) {
			return folders;
		}

		return folders.filter((folder) => folder.path.toLowerCase().includes(lowerQuery));
	}

	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.setText(folder.path);
	}

	selectSuggestion(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		this.setValue(folder.path);
		this.inputEl.dispatchEvent(new Event('input'));
		this.inputEl.dispatchEvent(new Event('change'));
		this.close();
	}
}

export class FileSuggest extends AbstractInputSuggest<TFile> {
	private inputEl: HTMLInputElement;

	constructor(app: App, inputEl: HTMLInputElement) {
		super(app, inputEl);
		this.inputEl = inputEl;
	}

	getSuggestions(query: string): TFile[] {
		const lowerQuery = query.toLowerCase().trim();
		const files = this.app.vault.getMarkdownFiles();

		if (!lowerQuery) {
			return files;
		}

		return files.filter((file) => file.path.toLowerCase().includes(lowerQuery));
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.setText(file.path);
	}

	selectSuggestion(file: TFile, evt: MouseEvent | KeyboardEvent): void {
		this.setValue(file.path);
		this.inputEl.dispatchEvent(new Event('input'));
		this.inputEl.dispatchEvent(new Event('change'));
		this.close();
	}
}
