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
import { attachCommands } from './obsidian/service/attachCommands'
import { registerMarkdownProcessors } from './obsidian/service/registerMarkdownProcessors'
import { registerAnnotationProcessor } from './obsidian/arrow/annotation'

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

		// 一些后处理器
		registerMarkdownProcessors(this)

		// 箭头注解代码块
		registerAnnotationProcessor(this)
		// 并且我希望箭头可以指着对应的文本，有三种： 1. 如果指向一个短文本，则用手绘风格的圈标出那个文本 2. 如果指向的是一个较长的文本，则使用波浪线标出 3. 如果仅指向一整行，则不特殊处理 可以使用createRange这个api实现吗：

		// this.registerEvent(
		// 	this.app.vault.on('modify', (file) => {
		// 		const view = this.app.workspace.getActiveViewOfType(MarkdownView)
		// 		if (!view || view.file !== file) return
		// 		// 延迟一帧，确保 Obsidian 已完成 DOM 更新
		// 		requestAnimationFrame(() => {
		// 			view.previewMode?.rerender(true)
		// 		})
		// 	})
		// )

		// this.registerEvent(
		// 	this.app.metadataCache.on('changed', (file) => {
		// 		const view = this.app.workspace.getActiveViewOfType(MarkdownView)
		// 		if (!view || view.file !== file) return
		// 		// requestAnimationFrame(() => {
		// 		view.previewMode?.rerender(true)
		// 		new Notice('xxxxxxxxxxxxxxxxxxxxx')
		// 		// })
		// 	})
		// )

		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (!view) return
				view.previewMode?.rerender(true)
			})
		)
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
