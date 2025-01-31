import { MarkdownRenderChild } from 'obsidian'
import { CyuTookitSettings } from 'src/settings/settingsData'
import { handleCopyImg, handleCopyText } from 'src/utils/HandleCopy'

export default class ClickCopyBlock extends MarkdownRenderChild {
	constructor(public settings: CyuTookitSettings, public renderedDiv: HTMLElement) {
		super(renderedDiv)
	}

	async onload() {
		this.renderClickCopyBlock(this.containerEl)
	}

	renderClickCopyBlock(container: HTMLElement) {
		const cpbs = container.findAll('.cpb') as HTMLLabelElement[]
		const enable_clickCopy_block = this.settings.enable_clickCopy_block

		for (const cpb of cpbs) {
			if (enable_clickCopy_block) {
				cpb.removeEventListener('click', this.clickHandler)
				cpb.addEventListener('click', this.clickHandler)
			} else {
				cpb.removeEventListener('click', this.clickHandler)
			}
		}
	}

	// 点击事件处理
	clickHandler(event: MouseEvent): void {
		const clickedSpan = (event.target as HTMLElement)?.closest(
			'span.cpb:not(:has(*))'
		) as HTMLElement

		const clickedImg = (event.target as HTMLElement)?.closest(
			':is(.cpb span) img'
		) as HTMLImageElement

		if (clickedSpan && !clickedImg) {
			handleCopyText(clickedSpan.innerText)
		}

		// 排除同时按下 ctrl 、shift 、 alt 、meta 键
		if (
			clickedImg &&
			!event.ctrlKey &&
			!event.shiftKey &&
			!event.altKey &&
			!event.metaKey
		) {
			handleCopyImg(clickedImg)
		}
	}
}
