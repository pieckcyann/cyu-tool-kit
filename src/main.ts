import {
	Editor,
	MarkdownPostProcessorContext,
	MarkdownView,
	Notice,
	Plugin,
	TFile,
	WorkspaceLeaf,
	WorkspaceRoot,
	WorkspaceSidedock,
	parseFrontMatterEntry,
	parseFrontMatterStringArray,
} from 'obsidian'
import { CyuToolkitPluginSettingTab, PluginSettingTab } from './setting/SettingTab'
import { CyuTookitSettings, DEFAULT_SETTINGS } from './setting/SettingData'
import { toggleHoverSidebar } from './cyu/toggleHoverSidebar'
import { setAutoPinned } from './cyu/setAutopinned'
import { attachCommands } from './obsidian/attachCommands'
import { registerMarkdownProcessors } from './obsidian/service/registerMarkdownProcessors'

export default class CyuToolkitPlugin extends Plugin {
	settings: CyuTookitSettings = DEFAULT_SETTINGS

	// Sidebar hook instance — holds refs and cleanup
	private sidebar: ReturnType<typeof toggleHoverSidebar> | null = null

	async onload() {
		await this.loadSettings()

		this.addSettingTab(new CyuToolkitPluginSettingTab(this.app, this))

		this.app.workspace.onLayoutReady(() => {
			this.sidebar = toggleHoverSidebar(this.app, this.settings)
			setAutoPinned(this.app, this.settings)
			attachCommands(this)
		})

		registerMarkdownProcessors(this)
	}

	onunload() {
		this.sidebar?.destroy()
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
	}

	async saveSettings() {
		await this.saveData(this.settings)
	}
}
