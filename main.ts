import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

interface AutoCloseOldestTabsSettings {
	maxTabs: number;
	alwaysNewTab: boolean;
}

const DEFAULT_SETTINGS: AutoCloseOldestTabsSettings = {
	maxTabs: 3,
	alwaysNewTab: true
}

export default class AutoCloseOldestTabsPlugin extends Plugin {
	settings: AutoCloseOldestTabsSettings;
	leafHistory: WorkspaceLeaf[] = [];
	originalGetLeaf: any;
	enforceTimeout: number | null = null;

	async onload() {
		await this.loadSettings();

		this.addSettingTab(new AutoCloseOldestTabsSettingTab(this.app, this));

		this.app.workspace.onLayoutReady(() => {
			this.patchWorkspace();
			this.cleanHistory();
			this.requestEnforceTabLimit();
		});

		// Track active leaf changes to update LRU history
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf && this.isMainWorkspaceLeaf(leaf)) {
					this.recordLeafAccess(leaf);
				}
				this.requestEnforceTabLimit();
			})
		);

		// Also check on layout changes, e.g. when a tab is opened in the background or closed
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				this.cleanHistory();
				this.requestEnforceTabLimit();
			})
		);
	}

	requestEnforceTabLimit() {
		if (this.enforceTimeout) {
			window.clearTimeout(this.enforceTimeout);
		}
		this.enforceTimeout = window.setTimeout(() => {
			this.enforceTabLimit();
			this.enforceTimeout = null;
		}, 100);
	}

	onunload() {
		this.unpatchWorkspace();
		this.leafHistory = [];
	}

	patchWorkspace() {
		this.originalGetLeaf = this.app.workspace.getLeaf;
		this.app.workspace.getLeaf = (newLeaf?: 'window' | 'tab' | 'split' | boolean, ...args: any[]) => {
			if (this.settings.alwaysNewTab && (newLeaf === false || newLeaf === undefined)) {
				const activeLeaf = this.app.workspace.activeLeaf;
				// If the active leaf is an empty tab, we should reuse it instead of creating a new one
				if (activeLeaf && activeLeaf.view && activeLeaf.view.getViewType() === 'empty') {
					return this.originalGetLeaf.call(this.app.workspace, newLeaf, ...args);
				}
				const createdLeaf = this.originalGetLeaf.call(this.app.workspace, 'tab', ...args);
				// Make the new tab active since Obsidian thought it was reusing the active tab
				setTimeout(() => {
					this.app.workspace.setActiveLeaf(createdLeaf, { focus: true });
				}, 10);
				return createdLeaf;
			}
			return this.originalGetLeaf.call(this.app.workspace, newLeaf, ...args);
		};
	}

	unpatchWorkspace() {
		if (this.originalGetLeaf) {
			this.app.workspace.getLeaf = this.originalGetLeaf;
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.requestEnforceTabLimit();
	}

	isMainWorkspaceLeaf(leaf: WorkspaceLeaf): boolean {
		const root = this.app.workspace.rootSplit;
		return leaf.getRoot() === root;
	}

	recordLeafAccess(leaf: WorkspaceLeaf) {
		// Remove if exists
		this.leafHistory = this.leafHistory.filter(l => l !== leaf);
		// Add to end (most recently used)
		this.leafHistory.push(leaf);
	}

	cleanHistory() {
		// Remove leaves that no longer exist or are no longer in the main workspace
		const currentLeaves = this.getAllMainLeaves();
		this.leafHistory = this.leafHistory.filter(l => currentLeaves.includes(l));
		
		// Any leaf that is currently open but not in our history is a newly discovered leaf.
		// We add it to the end of the history so it's treated as the newest.
		for (const leaf of currentLeaves) {
			if (!this.leafHistory.includes(leaf)) {
				this.leafHistory.push(leaf);
			}
		}
	}

	getAllMainLeaves(): WorkspaceLeaf[] {
		const allLeaves: WorkspaceLeaf[] = [];
		this.app.workspace.iterateAllLeaves((leaf) => {
			if (this.isMainWorkspaceLeaf(leaf)) {
				allLeaves.push(leaf);
			}
		});
		return allLeaves;
	}

	enforceTabLimit() {
		const allLeaves = this.getAllMainLeaves();
		if (allLeaves.length <= this.settings.maxTabs) {
			return;
		}

		// Sort leaves by their index in the history.
		// Lower index = older.
		// If a leaf is not in history (index -1), it means it was just opened and active-leaf-change hasn't fired yet.
		// We should treat it as the NEWEST leaf, not the oldest, so give it Infinity.
		allLeaves.sort((a, b) => {
			const indexA = this.leafHistory.indexOf(a);
			const indexB = this.leafHistory.indexOf(b);
			const valA = indexA === -1 ? Infinity : indexA;
			const valB = indexB === -1 ? Infinity : indexB;
			return valA - valB;
		});

		const numToClose = allLeaves.length - this.settings.maxTabs;
		let closedCount = 0;
		for (let i = 0; i < allLeaves.length; i++) {
			if (closedCount >= numToClose) break;
			
			const leafToClose = allLeaves[i];
			// Do not close if it's the currently active leaf just to be safe
			const activeLeaf = this.app.workspace.activeLeaf;
			if (leafToClose === activeLeaf && (allLeaves.length - closedCount) > 1) {
				continue; // Skip the active leaf if possible
			}
			leafToClose.detach(); // This closes the tab
			this.leafHistory = this.leafHistory.filter(l => l !== leafToClose);
			closedCount++;
		}
	}
}

class AutoCloseOldestTabsSettingTab extends PluginSettingTab {
	plugin: AutoCloseOldestTabsPlugin;

	constructor(app: App, plugin: AutoCloseOldestTabsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Maximum open tabs')
			.setDesc('The maximum number of tabs allowed to be open at the same time in the main workspace.')
			.addText(text => text
				.setPlaceholder('3')
				.setValue(this.plugin.settings.maxTabs.toString())
				.onChange(async (value) => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.settings.maxTabs = parsed;
						await this.plugin.saveSettings();
					}
				}));

		new Setting(containerEl)
			.setName('Always open in new tab')
			.setDesc('Prevent Obsidian from replacing the active tab when clicking on files or links. It will force them to open in a new tab instead.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.alwaysNewTab)
				.onChange(async (value) => {
					this.plugin.settings.alwaysNewTab = value;
					await this.plugin.saveSettings();
				}));
	}
}
