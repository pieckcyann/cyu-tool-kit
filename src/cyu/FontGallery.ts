import { MarkdownRenderChild, Notice } from 'obsidian'
import { CyuTookitSettings } from '../setting/SettingData'

export default class FontGallery extends MarkdownRenderChild {
	constructor(
		public settings: CyuTookitSettings,
		public renderedDiv: HTMLElement
	) {
		super(renderedDiv)
	}

	onload() {
		this.renderFontGallery()
	}

	renderFontGallery() {
		// 长文本测试内容
		const previewText =
			'The quick brown fox jumps over the lazy dog. 1234567890. \n' +
			'落霞与孤鹜齐飞，秋水共长天一色。 \n' +
			'Typography is the art and technique of arranging type. \n' +
			'符号测试：!@#$%^&*()_+-=[]{}|;\':",./<>?`~'

		// 1. 只看 code，不关心它在哪
		const codeElements = this.containerEl.querySelectorAll('code')

		codeElements.forEach((codeEl: HTMLElement) => {
			const fontName = codeEl.textContent?.trim() ?? ''
			if (!fontName) return

			// 2. 获取 code 的父容器（通常是 p 或 li）
			// 我们要把这个父容器里面的旧内容清空，换成我们的字体展示
			const container = codeEl.parentElement
			if (!container) return

			// 3. 像 ColorGallery 一样直接清空并重新构造
			container.empty()
			container.addClass('font-item-container')

			// --- 创建 字体名复制按钮 ---
			const btn = container.createEl('button', {
				cls: 'font-copy-button',
				text: fontName,
			})

			this.registerDomEvent(btn, 'click', () => {
				navigator.clipboard.writeText(fontName)
				new Notice(`已复制字体：${fontName}`)
			})

			// --- 创建 长段落预览区 ---
			const preview = container.createDiv({
				cls: 'font-preview-area',
				text: previewText,
			})

			// 关键：动态设置样式
			preview.style.fontFamily = `"${fontName}", sans-serif`
			preview.style.whiteSpace = 'pre-wrap'
			preview.style.marginTop = '10px'
			preview.style.padding = '10px'
			preview.style.border = '1px solid var(--background-modifier-border)'
			preview.style.borderRadius = '4px'
		})
	}
}
