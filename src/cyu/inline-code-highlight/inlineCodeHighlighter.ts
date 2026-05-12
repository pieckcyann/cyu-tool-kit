import { MarkdownPostProcessorContext } from 'obsidian'

/**
 * 处理阅读模式下的行内代码高亮
 * 使用方法：this.registerMarkdownPostProcessor(inlineCodeLanguageProcessor);
 */
export function inlineCodeHighlighter(element: HTMLElement) {
	const codeElements = element.querySelectorAll('code')

	codeElements.forEach((codeEl) => {
		const rawText = codeEl.innerText
		// 匹配格式: {lang}内容
		const match = rawText.match(/^\{([\w\+]+)\}(.*)/s)

		if (match) {
			const [_, lang, codeContent] = match

			if (lang) {
				// 更新文本内容，去除 {lang} 标记
				codeEl.innerText = codeContent

				// 添加类名：language-lang (标准 Markdown 习惯) 和自定义类
				// codeEl.addClass(`language-${lang}`)
				// codeEl.addClass(`cm-inline-code-${lang}`)

				codeEl.className = `language-${lang}`

				// // Obsidian 内部会确保 Prism 加载完成后再执行
				// // @ts-ignore
				// const prism = window.Prism
				// if (prism && prism.highlightElement) {
				// 	prism.highlightElement(codeEl)
				// } else {
				// 	// 如果 Prism 还没准备好，可以尝试在下个事件循环执行
				// 	setTimeout(() => {
				// 		// @ts-ignore
				// 		if (window.Prism?.highlightElement) {
				// 			// @ts-ignore
				// 			window.Prism.highlightElement(codeEl)
				// 		}
				// 	}, 0)
				// }
			}
		}
	})
}
