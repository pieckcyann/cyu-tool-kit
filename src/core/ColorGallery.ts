/* eslint-disable @typescript-eslint/no-unused-vars */
import { MarkdownRenderChild, Notice } from 'obsidian'
import { CyuTookitSettings } from 'src/settings/settingsData'

export default class ColorGallery extends MarkdownRenderChild {
	constructor(public settings: CyuTookitSettings, public renderedDiv: HTMLElement) {
		super(renderedDiv)
	}

	async onload() {
		this.renderColorGallery()
	}

	renderColorGallery() {
		const listItems = this.containerEl.findAll('li > ul > li')

		for (const listItem of listItems) {
			const colorValue = listItem.textContent ?? ''
			if (!colorValue) return

			const colorButton = createEl('button')
			colorButton.style.backgroundColor = colorValue
			colorButton.setAttribute('data-colorValue', colorValue)
			colorButton.setAttribute('aria-label', colorValue)
			colorButton.addEventListener('click', () => {
				navigator.clipboard.writeText(colorValue)
				new Notice('颜色值成功复制：' + colorValue)
			})
			colorButton.addEventListener('mouseover', () => {
				const parentElement = listItem.parentElement!.parentElement!
				parentElement.classList.add('transition-effects')
				parentElement.style.backgroundColor = colorValue
				// parentElement.style.boxShadow = `0px 4px 8px ${colorValue}`
				parentElement.style.borderColor = `${colorValue}`
			})

			colorButton.addEventListener('mouseout', () => {
				const parentElement = listItem.parentElement!.parentElement!
				parentElement.style.backgroundColor = '' // 清除背景颜色
				// parentElement.style.boxShadow = '' // 清除box-shadow
				parentElement.style.borderColor = ''
			})

			listItem.innerHTML = ''
			listItem.appendChild(colorButton)
		}
	}
}
