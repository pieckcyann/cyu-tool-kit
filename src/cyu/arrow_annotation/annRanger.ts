import { showRectIndicator } from '../../util/cyuUtil'

// ─── 找行首/行尾 ─────────────────────────────────────────────────────────────

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

/**
 * 获取目标块中第 n 行末首文字的位置矩形
 * @param targetBlock 目标块元素
 * @param lineNumber 行号 (1-based)
 */
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
 * 获取目标块中第 matchIndex 次出现的 matchText 的行首位置矩形
 * @param targetBlock 目标块元素
 * @param matchText 要匹配的文本
 * @param matchIndex 第几个出现 (1-based)
 */
/**
 * 跨节点匹配文本，获取行首位置矩形
 */
export function findLineStartRectByText(
	targetBlock: HTMLElement,
	matchText: string,
	matchIndex: number,
	options?: { skipLeadingWhitespace?: boolean }
): DOMRect | null {
	const skip = options?.skipLeadingWhitespace ?? true
	const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT)

	let node = walker.nextNode() as Text | null
	let foundCount = 0
	let buffer: { node: Text; text: string }[] = []

	while (node) {
		const text = node.textContent || ''
		if (text.length > 0) buffer.push({ node, text })
		node = walker.nextNode() as Text | null
	}

	// 累计跨节点匹配
	let i = 0 // buffer index
	let offsetInNode = 0
	let matchPos: { startNode: Text; startOffset: number } | null = null
	let matchedCount = 0

	let globalOffset = 0
	const flatText = buffer.map((b) => b.text).join('')

	while (globalOffset <= flatText.length - matchText.length) {
		if (flatText.substr(globalOffset, matchText.length) === matchText) {
			matchedCount++
			if (matchedCount === matchIndex) {
				// 找到对应全局 offset，映射到具体 node
				let remaining = globalOffset
				for (const b of buffer) {
					if (remaining <= b.text.length) {
						matchPos = { startNode: b.node, startOffset: remaining }
						break
					}
					remaining -= b.text.length
				}
				break
			}
		}
		globalOffset++
	}

	if (!matchPos) return null

	// 找行首
	let lineStartNode = matchPos.startNode
	let lineStartOffset = 0
	let nodeText = lineStartNode.textContent || ''
	for (let j = 0; j < matchPos.startOffset; j++) {
		if (nodeText[j] === '\n') lineStartOffset = j + 1
	}

	if (skip) {
		while (
			lineStartOffset < nodeText.length &&
			(nodeText[lineStartOffset] === ' ' || nodeText[lineStartOffset] === '\t')
		) {
			lineStartOffset++
		}
	}

	try {
		const range = document.createRange()
		range.setStart(lineStartNode, lineStartOffset)
		range.setEnd(lineStartNode, lineStartOffset)
		let rect = range.getBoundingClientRect()
		if (rect.height === 0 || rect.width === 0) {
			if (lineStartOffset + 1 <= nodeText.length)
				range.setEnd(lineStartNode, lineStartOffset + 1)
			rect = range.getBoundingClientRect()
		}
		return rect
	} catch {
		return null
	}
}

/**
 * 获取目标块中第 matchIndex 次出现的 matchText 的行尾位置矩形
 * @param targetBlock 目标块元素
 * @param matchText 要匹配的文本
 * @param matchIndex 第几个出现 (1-based)
 */
/**
 * 跨节点匹配文本，获取行尾位置矩形
 */
export function findLineEndRectByText(
	targetBlock: HTMLElement,
	matchText: string,
	matchIndex: number
): DOMRect | null {
	const walker = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT)
	let node = walker.nextNode() as Text | null
	let buffer: { node: Text; text: string }[] = []

	while (node) {
		const text = node.textContent || ''
		if (text.length > 0) buffer.push({ node, text })
		node = walker.nextNode() as Text | null
	}

	// 累计跨节点匹配
	let globalOffset = 0
	let matchedCount = 0
	let matchStartGlobal = -1

	const flatText = buffer.map((b) => b.text).join('')
	while (globalOffset <= flatText.length - matchText.length) {
		if (flatText.substr(globalOffset, matchText.length) === matchText) {
			matchedCount++
			if (matchedCount === matchIndex) {
				matchStartGlobal = globalOffset
				break
			}
		}
		globalOffset++
	}

	if (matchStartGlobal === -1) return null

	// 找对应节点和offset
	let remaining = matchStartGlobal + matchText.length
	let endNode: Text | null = null
	let endOffsetInNode = 0
	for (const b of buffer) {
		if (remaining <= b.text.length) {
			endNode = b.node
			endOffsetInNode = remaining
			break
		}
		remaining -= b.text.length
	}

	if (!endNode) return null

	// 找行尾（遇到 \n 停止）
	const walkerForEnd = document.createTreeWalker(targetBlock, NodeFilter.SHOW_TEXT)
	let foundStart = false
	let prevNode: Text = endNode
	let prevOffset = endOffsetInNode
	node = walkerForEnd.nextNode() as Text | null
	while (node) {
		if (node === endNode) {
			foundStart = true
			node = walkerForEnd.nextNode() as Text | null
			continue
		}
		if (!foundStart) {
			node = walkerForEnd.nextNode() as Text | null
			continue
		}

		const text = node.textContent || ''
		let newlineIndex = text.indexOf('\n')
		if (newlineIndex !== -1) {
			endNode = node
			endOffsetInNode = newlineIndex
			break
		}
		prevNode = node
		prevOffset = text.length
		endNode = node
		endOffsetInNode = text.length
		node = walkerForEnd.nextNode() as Text | null
	}

	try {
		const range = document.createRange()
		range.setStart(endNode, endOffsetInNode)
		range.setEnd(endNode, endOffsetInNode)
		let rect = range.getBoundingClientRect()
		if (rect.height === 0 || rect.width === 0) {
			if (endOffsetInNode > 0) range.setStart(endNode, endOffsetInNode - 1)
			rect = range.getBoundingClientRect()
		}
		return rect
	} catch {
		return null
	}
}

/**
 * 统计 targetBlock 中的总行数
 * 原理：总行数 = 换行符数量 + 1
 */
function countTotalLines(targetBlock: HTMLElement): number {
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

// ─── 找指定文字 ─────────────────────────────────────────────────────────────

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
