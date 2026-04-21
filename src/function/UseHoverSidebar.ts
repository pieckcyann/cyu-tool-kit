import { App } from 'obsidian'
import { CyuTookitSettings } from '../setting/settingsData'

/**
 * Manages sidebar hover/collapse behavior.
 * Returns a `destroy()` to remove all listeners on unload.
 */
export function UseHoverSidebar(app: App, settings: CyuTookitSettings) {
	const leftRibbon = document.querySelector<HTMLElement>('.side-dock-settings')
	const rightRibbon = document.querySelector<HTMLElement>(
		'.workspace-ribbon.side-dock-ribbon.mod-right'
	)
	const middleArea = document.querySelector<HTMLElement>('.mod-root')

	// ── handlers ──────────────────────────────────────────────────────────────

	const onEnterLeft = () => {
		if (app.workspace.leftSplit.collapsed) {
			app.workspace.leftSplit.toggle()
		}
	}

	const onEnterMiddle = () => {
		window.setTimeout(() => {
			if (!app.workspace.leftSplit.collapsed) app.workspace.leftSplit.toggle()
			if (!app.workspace.rightSplit.collapsed) app.workspace.rightSplit.toggle()
		}, 200)
	}

	const onEnterRight = () => {
		if (app.workspace.rightSplit.collapsed) {
			app.workspace.rightSplit.toggle()
		}
	}

	// ── register / unregister ─────────────────────────────────────────────────

	function register() {
		leftRibbon?.addEventListener('mouseenter', onEnterLeft)
		middleArea?.addEventListener('mouseenter', onEnterMiddle)
		rightRibbon?.addEventListener('mouseenter', onEnterRight)
	}

	function unregister() {
		leftRibbon?.removeEventListener('mouseenter', onEnterLeft)
		middleArea?.removeEventListener('mouseenter', onEnterMiddle)
		rightRibbon?.removeEventListener('mouseenter', onEnterRight)
	}

	if (settings.setup_enable_hover_sider) register()

	return {
		/** Re-enable hover mode */
		enable: register,
		/** Disable hover mode without destroying the hook */
		disable: unregister,
		/** Call on plugin unload */
		destroy: unregister,
	}
}
