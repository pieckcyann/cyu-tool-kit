import { App, Editor, Notice, TFile } from 'obsidian'
import { CyuTookitSettings } from '../setting/SettingData'
import { sortHeadings } from '../helper/sortHeadings'
import { toggleHoverSidebar } from './service/toggleHoverSidebar'
import CyuToolkitPlugin from '../main'
import { setAutoPinned } from './service/setAutopinned'
import {
	createLeftAnnotation,
	createRightAnnotation,
} from '../cyu/arrow_annotation/annCommand'

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
		editorCallback: () => sortHeadings(app),
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
