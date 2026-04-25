import {
	App,
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
import { toggleHoverSidebar } from './obsidian/service/toggleHoverSidebar'
import { attachCommands } from './obsidian/attachCommands'
import { registerPreviewProcessors } from './obsidian/registerPreviewProcessors'
import { timeTagViewPlugin } from './cyu/time_tag/TimeTagViewPlugin'
import { timeTagPostProcessor } from './cyu/time_tag/timeTagProcessor'
import { registerCodeblockProcessors } from './obsidian/registerCodeblockProcessor'

export default class CyuToolkitPlugin extends Plugin {
	settings: CyuTookitSettings = DEFAULT_SETTINGS

	// Sidebar hook instance — holds refs and cleanup
	private sidebar: ReturnType<typeof toggleHoverSidebar> | null = null

	async onload() {
		await this.loadSettings()

		this.addSettingTab(new CyuToolkitPluginSettingTab(this.app, this))

		this.app.workspace.onLayoutReady(() => {
			this.sidebar = toggleHoverSidebar(this.app, this.settings)
			// setAutoPinned(this.app, this.settings)
			attachCommands(this)
		})

		// - 注册后处理器

		// 修改阅读模式样式
		registerPreviewProcessors(this)

		// 修改代码块
		registerCodeblockProcessors(this)

		// - 注册事件回调

		// 切换笔记
		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf) => {
				if (leaf?.view instanceof MarkdownView) {
					// 只有当确定某些自定义状态改变了，且 Obsidian 默认渲染没覆盖到时才调用
					// 且尽量不要用 rerender(true) 强制清空缓存，除非后处理器依赖全局变量
					const view = leaf.view
					requestAnimationFrame(() => {
						view.previewMode?.rerender(true) // 不带 true，性能更好
					})
				}
			})
		)

		// 元数据变更
		// this.registerEvent(
		// 	this.app.metadataCache.on('changed', (file) => {
		// 		const view = this.app.workspace.getActiveViewOfType(MarkdownView)
		// 		if (!view || view.file !== file) return
		// 		requestAnimationFrame(() => {
		// 			view.previewMode?.rerender(true)
		// 		})
		// 	})
		// )

		// 笔记内容修改
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

		// 布局加载完毕
		this.registerEvent(
			this.app.workspace.on('layout-change', () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView)
				if (!view) return
				view.previewMode?.rerender(true)
			})
		)

		// 注册 CM6 编辑器插件
		this.registerEditorExtension(timeTagViewPlugin)

		// 注册阅读模式后处理器
		this.registerMarkdownPostProcessor(timeTagPostProcessor)
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
