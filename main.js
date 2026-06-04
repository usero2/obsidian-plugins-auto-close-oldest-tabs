'use strict';

var obsidian = require('obsidian');

const DEFAULT_SETTINGS = {
    maxTabs: 3,
    alwaysNewTab: true
};

class AutoCloseTabsPlugin extends obsidian.Plugin {
    constructor(app, manifest) {
        super(app, manifest);
        this.leafHistory = [];
        this.originalGetLeaf = null;
        this.enforceTimeout = null;
    }

    async onload() {
        await this.loadSettings();
        
        this.addSettingTab(new AutoCloseTabsSettingTab(this.app, this));

        this.app.workspace.onLayoutReady(() => {
            this.patchWorkspace();
            this.cleanHistory();
            this.requestEnforceTabLimit();
        });

        this.registerEvent(
            this.app.workspace.on('active-leaf-change', (leaf) => {
                if (leaf && this.isMainWorkspaceLeaf(leaf)) {
                    this.recordLeafAccess(leaf);
                }
                this.requestEnforceTabLimit();
            })
        );

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
        this.app.workspace.getLeaf = (newLeaf, ...args) => {
            if (this.settings.alwaysNewTab && (newLeaf === false || newLeaf === undefined)) {
                const activeLeaf = this.app.workspace.activeLeaf;
                if (activeLeaf && activeLeaf.view && activeLeaf.view.getViewType() === 'empty') {
                    return this.originalGetLeaf.call(this.app.workspace, newLeaf, ...args);
                }
                const createdLeaf = this.originalGetLeaf.call(this.app.workspace, 'tab', ...args);
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

    isMainWorkspaceLeaf(leaf) {
        const root = this.app.workspace.rootSplit;
        return leaf.getRoot() === root;
    }

    recordLeafAccess(leaf) {
        this.leafHistory = this.leafHistory.filter(l => l !== leaf);
        this.leafHistory.push(leaf);
    }

    cleanHistory() {
        const currentLeaves = this.getAllMainLeaves();
        this.leafHistory = this.leafHistory.filter(l => currentLeaves.includes(l));
        
        for (const leaf of currentLeaves) {
            if (!this.leafHistory.includes(leaf)) {
                this.leafHistory.push(leaf);
            }
        }
    }

    getAllMainLeaves() {
        const allLeaves = [];
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

        allLeaves.sort((a, b) => {
            return this.leafHistory.indexOf(a) - this.leafHistory.indexOf(b);
        });

        const numToClose = allLeaves.length - this.settings.maxTabs;
        let closedCount = 0;
        for (let i = 0; i < allLeaves.length; i++) {
            if (closedCount >= numToClose) break;

            const leafToClose = allLeaves[i];
            const activeLeaf = this.app.workspace.activeLeaf;
            if (leafToClose === activeLeaf && (allLeaves.length - closedCount) > 1) {
                continue;
            }
            leafToClose.detach();
            this.leafHistory = this.leafHistory.filter(l => l !== leafToClose);
            closedCount++;
        }
    }
}

class AutoCloseTabsSettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const {containerEl} = this;
        containerEl.empty();

        new obsidian.Setting(containerEl)
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

        new obsidian.Setting(containerEl)
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

module.exports = AutoCloseTabsPlugin;
