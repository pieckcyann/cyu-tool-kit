import { MarkdownRenderChild, Notice } from 'obsidian'
import { CyuTookitSettings } from '../../setting/SettingData'

export default class ColorGallery extends MarkdownRenderChild {
	constructor(
		public settings: CyuTookitSettings,
		public renderedDiv: HTMLElement
	) {
		super(renderedDiv)
	}

	async onload() {
		this.renderColorGallery()
	}

	/**
	 * 处理背景切换逻辑
	 */
	private toggleHoverEffect(el: HTMLElement, color: string, active: boolean) {
		el.classList.toggle('transition-effects', active)
		el.style.backgroundColor = active ? color : ''
		el.style.borderColor = active ? color : ''
	}

	renderColorGallery() {
		// 建议使用更精确的 scope 查找，避免污染全局
		const listItems = this.containerEl.querySelectorAll(
			'li > ul > li'
		) as NodeListOf<HTMLElement>

		listItems.forEach((listItem: HTMLElement) => {
			const colorValue = listItem.textContent?.trim() ?? ''
			if (!colorValue) return

			// 使用 Obsidian 推荐的 createEl 链式调用
			const colorButton = listItem.createEl('button', {
				attr: {
					'data-colorValue': colorValue,
					'aria-label': colorValue,
				},
				cls: 'color-gallery-button', // 建议通过 CSS 控制样式
			})

			// 设置初始背景色
			colorButton.style.backgroundColor = colorValue

			// 1. 点击复制
			this.registerDomEvent(colorButton, 'click', () => {
				navigator.clipboard.writeText(colorValue)
				new Notice(`颜色值成功复制：${colorValue}`)
			})

			// 获取父级元素引用
			const parentElement = listItem.parentElement?.parentElement

			// 2. 悬停效果 (使用 registerDomEvent 方便插件卸载时自动清理)
			if (parentElement) {
				this.registerDomEvent(colorButton, 'mouseover', () =>
					this.toggleHoverEffect(parentElement, colorValue, true)
				)
				this.registerDomEvent(colorButton, 'mouseout', () =>
					this.toggleHoverEffect(parentElement, colorValue, false)
				)
			}

			// 清空原本的文字节点（保留 button）
			listItem.childNodes.forEach((node) => {
				if (node !== colorButton) node.remove()
			})
		})
	}
}
