import { MarkdownPostProcessorContext, Notice } from 'obsidian'

export function timeTagPostProcessor(
	element: HTMLElement,
	context: MarkdownPostProcessorContext
) {
	// 取消了 ^ 和 $，允许在文本中间匹配
	// const regex = /@\{(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\}/g
	const regex = /@\{(\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2}:\d{2})?)\}/g

	// 使用 TreeWalker 只查找文本节点，效率更高且不会破坏现有 DOM 结构
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)

	let textNode: Text
	const matches: { range: Range; timestamp: string }[] = []

	// 收集所有匹配项的 Range
	// 注意：不能在遍历时直接修改 DOM，否则会使 Walker 失效
	while ((textNode = walker.nextNode() as Text)) {
		const text = textNode.nodeValue || ''
		let match

		// 重置正则索引
		regex.lastIndex = 0

		while ((match = regex.exec(text)) !== null) {
			const range = document.createRange()
			range.setStart(textNode, match.index)
			range.setEnd(textNode, match.index + match[0].length)

			matches.push({
				range,
				timestamp: match[1],
			})
		}
	}

	// 倒序执行替换 (从后往前替换不会影响前一个 Range 的偏移量)
	for (let i = matches.length - 1; i >= 0; i--) {
		const { range, timestamp } = matches[i]

		// 创建包裹容器
		const container = document.createElement('span')
		// 执行替换：将 Range 选中的文本移除，并插入新容器
		range.deleteContents()
		range.insertNode(container)

		renderTimeTag(container, timestamp)
	}
}

function renderTimeTag(tagSpan: HTMLElement, timestamp: string) {
	const parent = tagSpan.parentElement
	const prevEl = parent?.parentElement?.previousElementSibling

	// 1. 获取类名字符串，如果没有则为空字串
	const prevClassName = prevEl?.className || ''

	// 2. 正则匹配 el-h 后面跟着的一位数字
	const headingMatch = prevClassName.match(/el-h(\d)/)
	const isUnderHeading = headingMatch !== null
	const headingLevel = isUnderHeading ? headingMatch[1] : null // 这里就是 1, 2, 3...

	const isCalloutTitle = tagSpan.closest('.callout-title-inner') !== null

	const baseClassName = 'ctk-time-tag'
	tagSpan.addClass(baseClassName)

	if (isUnderHeading) {
		const divElP = parent!!.parentElement!!
		divElP.addClass('after-heading')

		tagSpan.addClass(`${baseClassName}--after-heading`)
		if (headingLevel) {
			tagSpan.addClass(`${baseClassName}--h${headingLevel}`)
		}
	} else if (isCalloutTitle) {
		tagSpan.addClass(`${baseClassName}--in-callout`)
	} else {
		tagSpan.addClass(`${baseClassName}--generic`)
	}

	tagSpan.innerHTML = `
        <span class="ctk-time-icon">
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
        </span>
        <span class="ctk-time-text">${timestamp}</span>
    `
}
