import { App } from 'obsidian'
import { CyuTookitSettings } from '../setting/settingsData'

/**
 * Pins every currently open markdown leaf if `enable_auto_pin` is on.
 * Call once after layout is ready, or re-call on demand via the returned function.
 */
export function useAutoPinned(app: App, settings: CyuTookitSettings) {
	function pinAll() {
		if (!settings.enable_auto_pin) return

		// 获取工作区中的所有笔记页面
		const allLeaves = app.workspace.getLeavesOfType('markdown')

		// 为每个笔记页面设置 pinned 状态
		allLeaves.forEach((leaf) => {
			if (!leaf.getViewState().pinned) {
				leaf.setPinned(true)
			}
		})
	}

	pinAll()

	return { pinAll }
}
