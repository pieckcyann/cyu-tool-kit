/* eslint-disable @typescript-eslint/no-unused-vars */
import { MarkdownRenderChild, Notice } from 'obsidian'
import { CyuTookitSettings } from 'src/settings/settingsData'

export default class IconGallery extends MarkdownRenderChild {
	constructor(public settings: CyuTookitSettings, public renderedDiv: HTMLElement) {
		super(renderedDiv)
	}

	async onload() {
		this.renderIconGallery()
	}

	renderIconGallery() {
		const listItems = this.containerEl.findAll('div > ul > li')

		for (const listItem of listItems) {
			const unescapeHtml = (str: string): string => {
				return str.replace(/&amp;|&lt;|&gt;|&quot;|&#x27;/g, (match) => {
					const unescapeMap: { [key: string]: string } = {
						'&amp;': '&',
						'&lt;': '<',
						'&gt;': '>',
						'&quot;': '"',
						'&#x27;': "'",
					}
					return unescapeMap[match] || match // 返回对应的原始字符
				})
			}

			const iconContainer = listItem.find('p')
			const iconCode = iconContainer.find('code')
			let iconText = iconCode.innerHTML.toString()

			// 反转义字符
			iconText = unescapeHtml(iconText)

			iconContainer.outerHTML = iconText

			// ---

			listItem.addEventListener('click', () => {
				navigator.clipboard.writeText(iconText)
				new Notice('图标值成功复制！')
			})

			const commentItem = listItem.find('ul > li')
			if (!commentItem) return
			const commentText = commentItem.textContent ?? ''
			if (!commentText) return
			listItem.setAttribute('aria-label', commentText)
		}
	}
}
