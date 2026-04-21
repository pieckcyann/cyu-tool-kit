import { Notice, TFile } from 'obsidian'
import type CyuToolkitPlugin from '../main'
import { useAutoPinned } from './useAutoPinned'
import { sortHeadings } from '../core/sortHeadings'
import { UseHoverSidebar } from './UseHoverSidebar'

/**
 * Registers all plugin commands.
 * Call once after layout is ready.
 */
export function useCommands(plugin: CyuToolkitPlugin) {
	const { app, settings } = plugin

	// Sidebar toggle — tracks mode between calls
	let toggleMode = 0 // 0 = hover on, 1 = off
	const sidebar = UseHoverSidebar(app, settings)

	// ── hover sidebar toggle ──────────────────────────────────────────────────
	plugin.addCommand({
		id: 'hover-toggle-sidebars-toggle',
		name: 'Toggle hover sidebars',
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

	// ── auto pin ──────────────────────────────────────────────────────────────
	plugin.addCommand({
		id: 'auto-pin-note',
		name: 'Auto pin all notes',
		callback: () => useAutoPinned(app, settings).pinAll(),
	})

	// ── sort headings ─────────────────────────────────────────────────────────
	plugin.addCommand({
		id: 'sort-headings-in-source',
		name: '源码模式下排序标题',
		hotkeys: [{ modifiers: ['Ctrl', 'Shift'], key: 'Q' }],
		editorCallback: () => sortHeadings(app),
	})

	// ── open home note ────────────────────────────────────────────────────────
	plugin.addCommand({
		id: 'open-specific-note',
		name: '打开主页笔记',
		hotkeys: [{ modifiers: ['Alt'], key: '`' }],
		callback: () => openNoteByPath(app, 'Kanban/Home/Home.kanban.md'),
	})
}

// ── helpers ───────────────────────────────────────────────────────────────────

async function openNoteByPath(app: any, notePath: string): Promise<void> {
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
