import { MarkdownPostProcessorContext } from 'obsidian'

export function timeTagPostProcessor(
	element: HTMLElement,
	context: MarkdownPostProcessorContext
) {
	// 1. 精准找到只包含该语法的段落
	const paragraphs = element.querySelectorAll('p')

	paragraphs.forEach((p: HTMLParagraphElement) => {
		// 优化正则：允许前后有空白，但必须是该行的唯一内容
		const regex = /^\s*@\{(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\}\s*$/
		const text = p.innerText
		const match = text.match(regex)

		if (match) {
			const timestamp = match[1]

			// 2. 创建精致的标签 DOM
			const span = document.createElement('span')
			span.addClass('ctk-time-tag') // 使用独特的 class prefix

			// 可选：添加时钟图标增强精致感
			const icon = document.createElement('span')
			icon.addClass('ctk-time-icon')
			icon.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`

			const timeText = document.createElement('span')
			timeText.setText(timestamp)

			span.appendChild(icon)
			span.appendChild(timeText)

			// 3. 重组 P 元素：它现在只是一个容器
			p.empty()
			p.appendChild(span)

			// 4. 给父级 P 元素添加特殊的 class 用于 CSS 布局重置
			p.addClass('ctk-time-container')
		}
	})
}
