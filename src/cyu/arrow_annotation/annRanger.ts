import { showRectIndicator } from '../../util/cyuUtil'

/**
 * 获取目标块中第 n 行末尾文字的位置矩形
 * @param targetBlock 目标块元素
 * @param lineNumber 行号 (1-based)
 */
export function findLineEndRect(
	targetBlock: HTMLElement,
	lineNumber: number
): DOMRect | null {
	const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT)
	let currentLine = 1
	let node = walker.nextNode() as Text | null

	while (node) {
		const text = node.textContent || ''
		let startSearchOffset = 0

		if (currentLine < lineNumber) {
			for (let i = 0; i < text.length; i++) {
				if (text[i] === '\n') {
					currentLine++
					if (currentLine === lineNumber) {
						startSearchOffset = i + 1
						break
					}
				}
			}
		}

		if (currentLine !== lineNumber) {
			node = walker.nextNode() as Text | null
			continue
		}

		if (startSearchOffset >= text.length) {
			node = walker.nextNode() as Text | null
			continue
		}

		// 在当前节点里找 \n
		let endNode: Text = node
		let endOffsetInNode = text.length
		let endedByNewline = false

		for (let i = startSearchOffset; i < text.length; i++) {
			if (text[i] === '\n') {
				if (i > startSearchOffset) {
					endOffsetInNode = i
				} else {
					// \n 紧接在 startSearchOffset，行内容为空，保持在当前位置
					endOffsetInNode = i
				}
				endedByNewline = true
				break
			}
		}

		// 没在当前节点找到 \n，跨节点继续找
		if (!endedByNewline) {
			let prevNode: Text = node
			let prevOffset: number = endOffsetInNode

			let nextNode = walker.nextNode() as Text | null
			while (nextNode) {
				const nextText = nextNode.textContent || ''
				let found = false
				for (let i = 0; i < nextText.length; i++) {
					if (nextText[i] === '\n') {
						if (i > 0) {
							// \n 不在节点开头，行尾就在本节点内
							endNode = nextNode
							endOffsetInNode = i
						} else {
							// \n 在节点开头，行尾在前一个节点末尾
							endNode = prevNode
							endOffsetInNode = prevOffset
						}
						endedByNewline = true
						found = true
						break
					}
				}
				if (found) break
				prevNode = nextNode
				prevOffset = nextText.length
				endNode = nextNode
				endOffsetInNode = nextText.length
				nextNode = walker.nextNode() as Text | null
			}
		}

		try {
			const range = document.createRange()
			range.setStart(endNode, endOffsetInNode)
			range.setEnd(endNode, endOffsetInNode)

			let rect = range.getBoundingClientRect()

			if (rect.height === 0 || rect.width === 0) {
				if (endOffsetInNode > 0) {
					range.setStart(endNode, endOffsetInNode - 1)
				}
				rect = range.getBoundingClientRect()
			}

			return rect
		} catch (e) {
			return null
		}
	}

	return null
}

export function findLineStartRect(
	targetBlock: HTMLElement,
	lineNumber: number,
	options?: {
		skipLeadingWhitespace?: boolean // 是否忽略行首的空白字符(例如代码的开头缩进)
	}
): DOMRect | null {
	const skip = options?.skipLeadingWhitespace ?? true

	const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT)
	let currentLine = 1
	let node = walker.nextNode() as Text | null

	while (node) {
		const text = node.textContent || ''
		let startSearchOffset = 0

		if (currentLine < lineNumber) {
			for (let i = 0; i < text.length; i++) {
				if (text[i] === '\n') {
					currentLine++
					if (currentLine === lineNumber) {
						startSearchOffset = i + 1
						break
					}
				}
			}
		}

		if (currentLine !== lineNumber) {
			node = walker.nextNode() as Text | null
			continue
		}

		if (startSearchOffset >= text.length) {
			node = walker.nextNode() as Text | null
			continue
		}

		// 👇 新增：跳过行首空白
		if (skip) {
			while (
				startSearchOffset < text.length &&
				(text[startSearchOffset] === ' ' || text[startSearchOffset] === '\t')
			) {
				startSearchOffset++
			}
		}

		try {
			const range = document.createRange()
			range.setStart(node, startSearchOffset)
			range.setEnd(node, startSearchOffset)

			let rect = range.getBoundingClientRect()

			if (rect.height === 0 || rect.width === 0) {
				if (startSearchOffset + 1 <= text.length) {
					range.setEnd(node, startSearchOffset + 1)
				}
				rect = range.getBoundingClientRect()
			}

			return rect
		} catch (e) {
			return null
		}
	}

	return null
}

/**
 * 统计 targetBlock 中的总行数
 * 原理：总行数 = 换行符数量 + 1
 */
export function countTotalLines(targetBlock: HTMLElement): number {
	const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT)
	let newlineCount = 0
	let hasContent = false
	let node = walker.nextNode()

	while (node) {
		const text = node.textContent || ''
		if (text.length > 0) {
			hasContent = true
		}

		// 统计当前节点中换行符的数量
		for (let i = 0; i < text.length; i++) {
			if (text[i] === '\n') {
				newlineCount++
			}
		}

		node = walker.nextNode()
	}

	// 如果没有任何文本内容，行数为 0 或 1 取决于业务逻辑，这里按习惯返回 0
	if (!hasContent) return 0

	// 总行数是换行符数量加 1
	return newlineCount
}

// export function findLineEndRect(
// 	targetBlock: HTMLElement,
// 	lineIndex: number
// ): DOMRect | null {
// 	const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT) // SHOW_TEXT: 只遍历文本结点
// 	let currentLine = 1
// 	let node = walker.nextNode()
//
// 	console.log('==================================')
// 	console.log(targetBlock)
// 	console.log('targetBlock.innerText:', targetBlock.innerText)
// 	let i = 0
//
// 	while (node) {
// 		const text = node.textContent || ''
// 		// 过滤脏文本节点
// 		if (text.trim() === '' && !text.includes('\n')) {
// 			node = walker.nextNode()
// 			continue
// 		}
//
// 		const lines = text
// 			// .replace(/\n$/, '') // 删除掉末尾的换行符
// 			.split('\n') // 以 \n 作为换行依据
//
// 		// console.log('i:', ++i)
// 		console.log('text:', text)
// 		// console.log('text.contains("\n")?', text.contains('\n'))
// 		// console.log('lines:', lines)
// 		// console.log('lines.length:', lines.length)
// 		// console.log('lineIndex:', lineIndex)
//
// 		// console.log('Node Parent:', node.parentElement)
//
// 		// 如果目标行在当前文本节点内
// 		if (currentLine + lines.length - 1 >= lineIndex) {
// 			const range = document.createRange()
//
// 			// 计算该行在节点内的起始偏移量
// 			let offsetInNode = 0
// 			for (let i = 0; i < lineIndex - currentLine; i++) {
// 				offsetInNode += lines[i].length + 1
// 			}
//
// 			const lineContent = lines[lineIndex - currentLine]
// 			// 找到该行最后一个非空白字符的位置，如果没有内容则指向行首
// 			const lastCharIndex = lineContent.search(/\s*$/)
//
// 			// console.log('lastCharIndex:', lastCharIndex)
//
// 			const endOffset =
// 				offsetInNode + (lastCharIndex > 0 ? lastCharIndex : lineContent.length)
//
// 			try {
// 				// 我们只需要一个点的位置，所以把 start 和 end 设为同一个偏移量
// 				// 指向该行文字的末尾
// 				range.setStart(node, endOffset)
// 				range.setEnd(node, endOffset)
//
// 				let rect = range.getBoundingClientRect()
//
// 				// 如果是彻底的空行，getBoundingClientRect 可能拿不到高度
// 				// 此时我们需要包含一个换行符来获得那一行的高度信息
// 				if (rect.height === 0) {
// 					const fallbackEnd = Math.min(endOffset + 1, text.length)
// 					range.setEnd(node, fallbackEnd)
// 					rect = range.getBoundingClientRect()
// 				}
//
// 				// console.log('==================================')
// 				// showRectIndicator(rect)
// 				return rect
// 			} catch (e) {
// 				return null
// 			}
// 		}
//
// 		currentLine += lines.length - 1
// 		node = walker.nextNode()
// 	}
// 	return null
// }

// export function findLineEndRect(
// 	targetBlock: HTMLElement,
// 	lineIndex: number
// ): DOMRect | null {
// 	// 收集 targetBlock 内所有叶子文本节点，用 Range 逐字符扫描，
// 	// 按 Y 坐标变化识别视觉行，找到第 lineIndex 行的末尾位置
//
// 	// 先排除 button 等非内容元素
// 	const contentRoot = targetBlock.querySelector('code') ?? targetBlock
//
// 	const walker = document.createTreeWalker(contentRoot, NodeFilter.SHOW_TEXT)
// 	const nodes: Text[] = []
// 	let n: Text | null
// 	while ((n = walker.nextNode() as Text | null)) {
// 		// 跳过 copy button 里的文本
// 		if ((n.parentElement as HTMLElement)?.closest('button')) continue
// 		nodes.push(n)
// 	}
//
// 	// 用第一个字符的 rect 作为基准，按 top 变化识别行边界
// 	let currentLine = 1
// 	let lastTop: number | null = null
// 	let lastRect: DOMRect | null = null
//
// 	for (const node of nodes) {
// 		const text = node.textContent ?? ''
// 		for (let i = 0; i < text.length; i++) {
// 			const range = document.createRange()
// 			range.setStart(node, i)
// 			range.setEnd(node, i + 1)
// 			const rect = range.getBoundingClientRect()
//
// 			if (rect.width === 0 && rect.height === 0) continue
//
// 			// Y 坐标明显变化 → 换行了
// 			if (lastTop !== null && rect.top > lastTop + rect.height * 0.5) {
// 				currentLine++
// 				if (currentLine > lineIndex) break
// 			}
//
// 			if (currentLine === lineIndex) {
// 				lastRect = rect // 持续更新，最后一个就是行末
// 			}
//
// 			lastTop = rect.top
// 		}
// 		if (currentLine > lineIndex) break
// 	}
//
// 	if (!lastRect) return null
//
// 	// lastRect 是行末最后一个字符的 rect，right 就是行末 X
// 	return lastRect
// }

/**
 * 获取指定行的视觉末尾 rect
 */
export function findLineEndRectPrism(
	codeBlock: HTMLElement,
	lineIndex: number
): DOMRect | null {
	// 如果 codeBlock 本身是 <pre><code>
	const codeEl =
		codeBlock.tagName === 'PRE'
			? (codeBlock.querySelector('code') ?? codeBlock)
			: codeBlock

	// Prism 默认每行在 <span> 或文本节点里，但 data-line 标记行号时可以直接匹配
	const lines = Array.from(codeEl.childNodes)
	let currentLine = 1

	for (const node of lines) {
		// 过滤掉 button、非内容节点
		if ((node as HTMLElement)?.closest?.('button')) continue

		if (currentLine === lineIndex) {
			const rects: DOMRect[] = []

			const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null)
			let n: Text | null
			while ((n = walker.nextNode() as Text | null)) {
				const range = document.createRange()
				range.selectNodeContents(n)
				const r = range.getBoundingClientRect()
				if (r.width > 0 && r.height > 0) rects.push(r)
			}

			if (rects.length === 0) return null

			// 最大 right 即行末
			const top = rects[0].top
			const height = rects[0].height
			const right = Math.max(...rects.map((r) => r.right))
			const left = Math.min(...rects.map((r) => r.left))

			return new DOMRect(left, top, right - left, height)
		}

		// 换行计数：Prism 默认换行用 '\n' 或多 span 分割
		if (node.nodeType === Node.TEXT_NODE) {
			currentLine += node.textContent?.match(/\n/g)?.length ?? 0
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			currentLine += node.textContent?.match(/\n/g)?.length ?? 0
		}
	}

	return null
}

/**
 * 获取目标块中第 n 行的位置矩形
 * @param targetBlock 目标容器 (如 <pre> 或 <div>)
 * @param lineIndex 行号 (1-based)
 */
export function findLineRect(
	targetBlock: HTMLElement,
	lineIndex: number
): { rect: DOMRect } | null {
	// 1. 获取所有文本节点
	const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT)
	let currentLine = 1
	let node = walker.nextNode()

	while (node) {
		const text = node.textContent || ''
		const lines = text.split('\n')

		// 如果当前文本节点包含了我们想要的行
		if (currentLine + lines.length - 1 >= lineIndex) {
			const range = document.createRange()

			// 计算在该节点内的相对偏移
			// 找到该行在文本节点中的起始位置
			let startOffset = 0
			for (let i = 0; i < lineIndex - currentLine; i++) {
				startOffset += lines[i].length + 1 // +1 是换行符
			}

			// 确定结束位置（本行末尾）
			const lineText = lines[lineIndex - currentLine]
			const endOffset = startOffset + lineText.length

			try {
				range.setStart(node, startOffset)
				range.setEnd(node, endOffset)

				// 如果是空行，range.getBoundingClientRect() 可能返回全 0
				// 此时我们需要稍微特殊处理，选中换行符
				let rect = range.getBoundingClientRect()
				if (rect.width === 0 && startOffset < text.length) {
					range.setEnd(node, startOffset + 1)
					rect = range.getBoundingClientRect()
				}

				return { rect }
			} catch (e) {
				return null
			}
		}

		currentLine += lines.length - 1
		node = walker.nextNode()
	}

	return null
}

/**
 * 用 Range API 在元素内精确定位文本位置
 * @param root 目标元素
 * @param matchText 寻找的文本
 * @param matchIndex 多次出现时的第几个
 * @returns 返回其 DOMRect (相对 viewport)。
 * 			返回 null 表示未找到。
 */
export function findTextRect(
	root: HTMLElement,
	matchText: string,
	matchIndex: number
): { rect: DOMRect; range: Range } | null {
	if (!matchText) return null

	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
	// 收集所有文本节点，拼接成全文，同时记录每个节点的起始偏移
	const nodes: Text[] = []
	const offsets: number[] = []
	let total = 0

	let node: Text | null
	while ((node = walker.nextNode() as Text | null)) {
		offsets.push(total)
		nodes.push(node)
		total += node.length
	}

	const fullText = nodes.map((n) => n.textContent ?? '').join('')

	// 找第 matchIndex 次出现
	let searchFrom = 0
	let found = -1
	for (let i = 0; i < matchIndex; i++) {
		const idx = fullText.indexOf(matchText, searchFrom)
		if (idx === -1) return null
		found = idx
		searchFrom = idx + 1
	}

	// 把全文偏移映射回具体节点 + 节点内偏移
	const startGlobal = found
	const endGlobal = found + matchText.length

	const startInfo = globalOffsetToNode(nodes, offsets, startGlobal)
	const endInfo = globalOffsetToNode(nodes, offsets, endGlobal)
	if (!startInfo || !endInfo) return null

	const range = document.createRange()
	range.setStart(startInfo.node, startInfo.offset)
	range.setEnd(endInfo.node, endInfo.offset)

	// getClientRects() 返回多行时取第一个 (通常注释 match 不会跨很多行)
	const rects = Array.from(range.getClientRects())
	if (rects.length === 0) return null

	// 若跨行，合并成一个包围 rect
	const merged = mergeRects(rects)
	return { rect: merged, range }
}

function globalOffsetToNode(
	nodes: Text[],
	offsets: number[],
	globalOffset: number
): { node: Text; offset: number } | null {
	for (let i = nodes.length - 1; i >= 0; i--) {
		if (offsets[i] <= globalOffset) {
			return { node: nodes[i], offset: globalOffset - offsets[i] }
		}
	}
	return null
}

function mergeRects(rects: DOMRect[]): DOMRect {
	const left = Math.min(...rects.map((r) => r.left))
	const top = Math.min(...rects.map((r) => r.top))
	const right = Math.max(...rects.map((r) => r.right))
	const bottom = Math.max(...rects.map((r) => r.bottom))
	return new DOMRect(left, top, right - left, bottom - top)
}
