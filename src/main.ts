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
import { TimeTagViewPlugin } from './cyu/time_tag/TimeTagViewPlugin'
import { TimeTagChild } from './cyu/time_tag/TimeTagChild'
import { registerCodeblockProcessors } from './obsidian/registerCodeblockProcessor'
import { AnnotationChild } from './cyu/arrow_annotation/AnnotationChild'
import { customFoldExtension, autoFoldPlugin } from './cyu/AutoFoldViewPlugin'

export default class CyuToolkitPlugin extends Plugin {
	settings: CyuTookitSettings = DEFAULT_SETTINGS

	// Sidebar hook instance — holds refs and cleanup
	private sidebar: ReturnType<typeof toggleHoverSidebar> | null = null

	private observer: MutationObserver | null = null
	private timeoutId: number | null = null

	async onload() {
		await this.loadSettings()

		this.addSettingTab(new CyuToolkitPluginSettingTab(this.app, this))

		this.app.workspace.onLayoutReady(() => {
			this.sidebar = toggleHoverSidebar(this.app, this.settings)
			// setAutoPinned(this.app, this.settings)
			attachCommands(this)
		})

		// - 注册阅读模式后处理器

		// 修改阅读模式样式
		registerPreviewProcessors(this)

		// 修改代码块
		registerCodeblockProcessors(this)

		// - 注册源码模式的编辑器扩展

		// 注册 CM6 编辑器插件
		this.registerEditorExtension([
			TimeTagViewPlugin, // 时间戳语法文本渲染
			customFoldExtension, // 自定义折叠区域
			autoFoldPlugin,
		])

		// - 注册事件回调

		// 	plugin.registerEvent(
		// 		plugin.app.workspace.on('layout-change', () => {
		// 			// 每次布局变化后触发，包括初始渲染完成
		// 		})
		// 	)
		//
		// 	plugin.registerEvent(
		// 		plugin.app.metadataCache.on('resolved', () => {
		// 			// 文件的 metadata 全部解析完，此时渲染也基本稳定
		// 		})
		// 	)

		// 切换笔记
		// this.registerEvent(
		// 	this.app.workspace.on('active-leaf-change', (leaf) => {
		// 		if (leaf?.view instanceof MarkdownView) {
		// 			// 只有当确定某些自定义状态改变了，且 Obsidian 默认渲染没覆盖到时才调用
		// 			// 且尽量不要用 rerender(true) 强制清空缓存，除非后处理器依赖全局变量
		// 			const view = leaf.view
		// 			requestAnimationFrame(() => {
		// 				view.previewMode?.rerender(true) // 不带 true，性能更好
		// 			})
		// 		}
		// 	})
		// )

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

		// 布局加载完毕 (例如切换模式时)
		// 		this.registerEvent(
		// 			this.app.workspace.on('layout-change', () => {
		// 				const activeView = this.app.workspace.getActiveViewOfType(MarkdownView)
		// 				if (!activeView) return
		//
		// 				// 刷新注释
		// 				// 				// 1. 获取预览模式（阅读模式）的渲染器
		// 				// 				const previewMode = activeView.previewMode
		// 				//
		// 				// 				// 2. 访问隐藏在渲染器内部的 renderer.childComponents
		// 				// 				// 注意：这是 Obsidian 的内部属性，需要进行类型断言
		// 				// 				const renderer = (previewMode as any).renderer
		// 				// 				if (renderer && renderer.childComponents) {
		// 				// 					const children = renderer.childComponents as any[]
		// 				//
		// 				// 					// 3. 筛选并执行实例
		// 				// 					children.forEach((child) => {
		// 				// 						console.log("child:",child)
		// 				// 						// 判断 child 是否为 AnnotationChild 实例
		// 				// 						// 建议在 AnnotationChild 类里加一个标识符，或者直接用 instanceof
		// 				// 						if (child instanceof AnnotationChild) {
		// 				// 							child.reload()
		// 				// 						}
		// 				// 					})
		// 				// }
		//
		// 				activeView.previewMode.rerender() // 不用 true 性能更好
		//
		// 				// 页面过渡
		// 				// 				if (activeView.getState().mode === 'preview') {
		// 				// 					const container = activeView.contentEl
		// 				//
		// 				// 					// 1. 立即锁定布局，防止滚动条乱跳
		// 				// 					container.style.overflow = 'hidden'
		// 				// 					container.classList.add('fast-transition-blur')
		// 				//
		// 				// 					// 2. 快速检测逻辑：只要核心预览层挂载，就开始淡入
		// 				// 					const checkInterval = setInterval(() => {
		// 				// 						const previewEl = container.querySelector('.markdown-rendered')
		// 				//
		// 				// 						// 如果找到了渲染层，或者时间超过了 400ms (人类感知的延迟极限)
		// 				// 						if (previewEl || Date.now() - startTime > 400) {
		// 				// 							clearInterval(checkInterval)
		// 				//
		// 				// 							// 3. 执行平滑渐显
		// 				// 							requestAnimationFrame(() => {
		// 				// 								container.classList.remove('fast-transition-blur')
		// 				// 								container.classList.add('fast-transition-in')
		// 				//
		// 				// 								// 恢复滚动
		// 				// 								setTimeout(() => {
		// 				// 									container.style.overflow = ''
		// 				// 									container.classList.remove('fast-transition-in')
		// 				// 								}, 300)
		// 				// 							})
		// 				// 						}
		// 				// 					}, 50) // 每 50ms 检查一次，比 Observer 响应更快
		// 				//
		// 				// 					const startTime = Date.now()
		// 				// 				}
		// 			})
		// 		)
	}

	forceShow(el: HTMLElement) {
		el.classList.remove('is-transitioning-hidden')
		el.classList.add('is-transitioning-fade-in')
		this.cleanup()
	}

	cleanup() {
		if (this.observer) this.observer.disconnect()
		if (this.timeoutId) window.clearTimeout(this.timeoutId)
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
