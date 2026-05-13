import { App, Editor, MarkdownView, Notice, TFile } from 'obsidian'
import { CyuTookitSettings } from '../setting/SettingData'
import { removeHeadingPrefix, sortHeadings } from '../helper/sortHeadings'
import { toggleHoverSidebar } from './service/toggleHoverSidebar'
import CyuToolkitPlugin from '../main'
import { setAutoPinned } from './service/setAutopinned'
import {
	createLeftAnnotation,
	createRightAnnotation,
} from '../cyu/arrow-annotation/annCommand'

/**
 * Registers all plugin commands.
 * Call once after layout is ready.
 */
export function attachCommands(plugin: CyuToolkitPlugin) {
	const { app, settings } = plugin

	// Sidebar toggle — tracks mode between calls
	let toggleMode = 0 // 0 = hover on, 1 = off
	const sidebar = toggleHoverSidebar(app, settings)

	// ── hover sidebar toggle ──────────────────────────────────────────────────
	plugin.addCommand({
		id: 'hover-toggle-sidebars-toggle',
		name: '切换侧边栏的展开触发方式',
		hotkeys: [{ modifiers: ['Ctrl', 'Alt'], key: 'W' }],
		callback: () => {
			sidebar.disable()

			if (toggleMode === 0) {
				sidebar.enable()
				new Notice('已改为 "悬浮触发"')
			} else {
				new Notice('已改为 "不触发"')
			}

			toggleMode = (toggleMode + 1) % 2
		},
	})

	plugin.addCommand({
		id: 'auto-pin-note',
		name: '自动固定所有笔记',
		callback: () => setAutoPinned(app, settings).pinAll(),
	})

	plugin.addCommand({
		id: 'sort-headings-in-source',
		name: '源码模式下排序标题',
		hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'Q' }],
		editorCallback: async () => {
			if (await sortHeadings(app)) {
				new Notice('标题和引用都已更新')
			} else {
				new Notice('没有需要更新的标题')
			}
		},
	})

	plugin.addCommand({
		id: 'delete-headings-prefix-in-source',
		name: '源码模式下删除标题前缀',
		editorCallback: () => {
			const file = app.workspace.getActiveFile()
			if (!file) return
			app.vault.process(file, removeHeadingPrefix)
			new Notice('删除了标题前缀')
		},
	})

	plugin.addCommand({
		id: 'open-specific-note',
		name: '打开主页笔记',
		hotkeys: [{ modifiers: ['Alt'], key: '`' }],
		callback: () => openNoteByPath(app, 'Kanban/Home/Home.kanban.md'),
	})

	plugin.addCommand({
		id: 'insert-timestamp-under-heading',
		name: '插入时间戳标签',
		hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'T' }],
		editorCallback: (editor: Editor) => {
			const cursor = editor.getCursor()
			const lineContent = editor.getLine(cursor.line)

			// 生成符合 @{YYYY-MM-DD HH:mm:ss} 格式的时间戳
			// @ts-ignore (Obsidian 内置了 moment)
			const timestamp = `@{${window.moment().format('YYYY-MM-DD HH:mm:ss')}}`

			// 逻辑：如果当前行是标题，则在下一行插入
			if (lineContent.startsWith('#')) {
				// 在当前行后面插入换行和时间戳
				editor.replaceRange(`\n${timestamp}`, {
					line: cursor.line,
					ch: lineContent.length,
				})
				// 将光标移到时间戳下方的空行，方便继续写内容
				editor.setCursor({ line: cursor.line + 2, ch: 0 })
			} else {
				// 如果不是标题，直接在当前位置插入并换行
				editor.replaceSelection(`${timestamp}\n`)
			}
		},
	})

	plugin.addCommand({
		id: 'insert-arrow-annotation-right',
		name: 'you right 创建右侧注解',
		editorCallback: createRightAnnotation,
	})

	plugin.addCommand({
		id: 'insert-arrow-annotation-left',
		name: 'zuo left 创建左侧注解',
		editorCallback: createLeftAnnotation,
	})

	plugin.addCommand({
		id: 'sync-headings-to-aliases-overwrite',
		name: '同步所有标题到 YAML Aliases (全覆盖)',
		// 使用 callback 确保在非编辑模式下（如纯预览模式）点击菜单或快捷键也能触发
		callback: async () => {
			// 1. 获取当前活跃的 Markdown 视图
			const activeView = app.workspace.getActiveViewOfType(MarkdownView)

			if (!activeView || !activeView.file) {
				new Notice('请先打开一个 Markdown 文件')
				return
			}

			const file = activeView.file

			// 2. 从缓存获取所有标题
			const cache = app.metadataCache.getFileCache(file)
			const headings = cache?.headings?.map((h) => h.heading) || []

			if (headings.length === 0) {
				new Notice('未发现标题，未执行更新')
				return
			}

			try {
				// 3. 安全更新 YAML 区
				await app.fileManager.processFrontMatter(file, (frontmatter) => {
					// 直接赋值，实现全覆盖
					frontmatter.aliases = headings
				})

				new Notice(`已成功覆盖 aliases，共 ${headings.length} 个标题`)
			} catch (e) {
				console.error('更新 YAML 失败:', e)
				new Notice('更新 Aliases 失败，请检查文件格式')
			}
		},
	})

	// 	plugin.addCommand({
	// 		id: 'smooth-toggle-preview',
	// 		name: 'Toggle preview (smooth)',
	// 		callback: () => {
	// 			const view = app.workspace.getActiveViewOfType(MarkdownView)
	// 			if (!view) return
	//
	// 			triggerTransition(view.containerEl)
	//
	// 			// 执行原命令
	// 			;(app as any).commands.executeCommandById('markdown:toggle-preview')
	// 		},
	// 	})

	plugin.addCommand({
		id: 'refresh-current-note',
		name: '刷新当前笔记',
		hotkeys: [{ modifiers: ['Ctrl'], key: 'R' }],
		checkCallback: (checking: boolean) => {
			const activeView = app.workspace.getActiveViewOfType(MarkdownView)

			if (activeView) {
				if (!checking) {
					// 强制视图重建
					// @ts-ignore - 访问内部 API
					activeView.leaf.rebuildView()
				}
				return true
			}
			return false
		},
	})

	plugin.addCommand({
		id: 'ctk-test',
		name: '测试测试测试',
		callback: () => {
			// renameTheHeading(app, '测试标题', '新测试标题')
		},
	})

	plugin.addCommand({
		id: 'new-tab-and-command-palette-open',
		name: '新建Tab并执行命令',
		hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'p' }],
		callback: () => {
			// @ts-ignore
			app.commands.executeCommandById('workspace:new-tab')
			// @ts-ignore
			app.commands.executeCommandById('command-palette:open')
		},
	})

	plugin.addCommand({
		id: 'new-tab-and-switcher-open',
		name: '新建Tab并选择文件',
		hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'o' }],
		callback: () => {
			// @ts-ignore
			app.commands.executeCommandById('workspace:new-tab')
			// @ts-ignore
			app.commands.executeCommandById('switcher:open')
		},
	})
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function openNoteByPath(app: App, notePath: string): Promise<void> {
	const file = app.vault.getAbstractFileByPath(notePath)
	if (!(file instanceof TFile)) {
		console.warn('File not found:', notePath)
		return
	}

	const leaf = app.workspace.getLeaf('tab')
	await leaf.openFile(file, { active: true })

	window.setTimeout(() => {
		app.workspace.setActiveLeaf(leaf, { focus: true })
	}, 0)

	if (!leaf.getViewState().pinned) leaf.setPinned(true)
}
