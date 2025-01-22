import { MarkdownRenderChild } from 'obsidian'
import { CyuTookitSettings } from 'src/settings/settingsData'
import { handleCopyImg, handleCopyText } from 'src/utils/HandleCopy'

export default class ClickCopyBlock extends MarkdownRenderChild {
	constructor(
		public settings: CyuTookitSettings,
		public renderedDiv: HTMLElement,
		public isR34Twitter: boolean
	) {
		super(renderedDiv)
	}

	async onload() {
		this.renderClickCopyBlock(this.containerEl)
		if (!this.isR34Twitter) {
			this.updateExternalImageTags(this.containerEl)
		}
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

	updateExternalImageTags(container: HTMLElement) {
		const imgs = container.findAll(
			'img[referrerpolicy="no-referrer"]'
		) as HTMLImageElement[]

		for (const img of imgs) {
			// 创建一个新的 span 元素
			const span = document.createElement('span')
			span.className = 'external-embed'

			// 获取 img 的 width 和 alt 属性值
			const width = img.getAttribute('width')
			const alt = img.getAttribute('alt')

			// 如果 width 存在，设置到 span
			if (width) {
				span.style.width = width
			}

			// 如果 alt 存在，设置到 span 的 title 属性（或其他你需要的属性）
			if (alt) {
				span.setAttribute('alt', alt)
			}

			// 将 img 插入到新的 span 中
			img.parentNode?.insertBefore(span, img)
			span.appendChild(img)
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
