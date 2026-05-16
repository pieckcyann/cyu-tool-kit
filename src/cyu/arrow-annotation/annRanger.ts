// annRanger.ts
import { showRectIndicator } from '../../util/cyuUtil'

// ─── 找图片的首尾 ─────────────────────────────────────────────────────────────

export function findImageRect(targetBlock: HTMLElement): DOMRect | null {
	// 在目标块中寻找 img 标签
	const img = targetBlock.querySelector('img')
	if (img) {
		return img.getBoundingClientRect()
	}
	return null
}

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

	console.log('countTotalLines:', countTotalLines(targetBlock))

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
	const buffer: { node: Text; text: string; startAt: number }[] = []

	let totalLen = 0
	let node: Text | null
	while ((node = walker.nextNode() as Text)) {
		const t = node.textContent || ''
		buffer.push({ node, text: t, startAt: totalLen })
		totalLen += t.length
	}

	const flatText = buffer.map((b) => b.text).join('')

	// 1. 找到匹配文本的全局起点
	let matchGlobalPos = -1
	let foundCount = 0
	while ((matchGlobalPos = flatText.indexOf(matchText, matchGlobalPos + 1)) !== -1) {
		foundCount++
		if (foundCount === matchIndex) break
	}

	if (matchGlobalPos === -1) return null

	// 2. 核心修正：在全局文本中向前找行首 (\n)
	// 这样无论 \n 在哪个节点，都能找到
	let lineStartGlobalPos = flatText.lastIndexOf('\n', matchGlobalPos)
	if (lineStartGlobalPos === -1) {
		lineStartGlobalPos = 0 // 没找到换行，说明在第一行
	} else {
		lineStartGlobalPos += 1 // 跳过 \n 字符本身
	}

	// 3. 将全局索引映射回具体的 Node 和 Offset
	let targetNode: Text | null = null
	let targetOffset = 0
	for (const b of buffer) {
		if (
			lineStartGlobalPos >= b.startAt &&
			lineStartGlobalPos < b.startAt + b.text.length
		) {
			targetNode = b.node
			targetOffset = lineStartGlobalPos - b.startAt
			break
		}
	}

	if (!targetNode) return null

	// 4. 处理跳过空格
	const nodeText = targetNode.textContent || ''
	if (skip) {
		while (targetOffset < nodeText.length && /[ \t]/.test(nodeText[targetOffset])) {
			targetOffset++
		}
	}

	// 5. 测量位置
	const range = document.createRange()
	range.setStart(targetNode, targetOffset)
	range.setEnd(targetNode, targetOffset)
	// ... 后续 getBoundingClientRect 逻辑保持不变
	let rect = range.getBoundingClientRect()
	if (rect.width === 0 && targetOffset < nodeText.length) {
		range.setEnd(targetNode, targetOffset + 1)
		rect = range.getBoundingClientRect()
	}
	return rect
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
	const buffer: { node: Text; text: string; startAt: number }[] = []

	let totalLen = 0
	let node: Text | null
	while ((node = walker.nextNode() as Text)) {
		const t = node.textContent || ''
		buffer.push({ node, text: t, startAt: totalLen })
		totalLen += t.length
	}

	const flatText = buffer.map((b) => b.text).join('')

	// 1. 找到匹配文本第 N 次出现的全局起始位置
	let matchGlobalPos = -1
	let foundCount = 0
	while ((matchGlobalPos = flatText.indexOf(matchText, matchGlobalPos + 1)) !== -1) {
		foundCount++
		if (foundCount === matchIndex) break
	}

	if (matchGlobalPos === -1) return null

	// 2. 计算匹配文本之后的全局索引
	const endOfMatchPos = matchGlobalPos + matchText.length

	// 3. 在全局文本中向后找第一个换行符 \n
	let lineEndGlobalPos = flatText.indexOf('\n', endOfMatchPos)

	// 如果后面没有换行符了，则行尾就是整个块的文本末尾
	if (lineEndGlobalPos === -1) {
		lineEndGlobalPos = flatText.length
	}

	// 4. 将全局索引映射回具体的 Node 和 Offset
	let targetNode: Text | null = null
	let targetOffset = 0

	for (const b of buffer) {
		// 注意：行尾可能指向节点末尾，所以用 <=
		if (lineEndGlobalPos >= b.startAt && lineEndGlobalPos <= b.startAt + b.text.length) {
			targetNode = b.node
			targetOffset = lineEndGlobalPos - b.startAt
			break
		}
	}

	if (!targetNode) return null

	// 5. 测量位置
	try {
		const range = document.createRange()
		range.setStart(targetNode, targetOffset)
		range.setEnd(targetNode, targetOffset)

		let rect = range.getBoundingClientRect()

		// 容错处理：如果正好在行尾且 rect 宽高为 0
		// 尝试向前取一个字符来获取当前行的位置信息
		if (rect.height === 0 || rect.width === 0) {
			if (targetOffset > 0) {
				range.setStart(targetNode, targetOffset - 1)
			} else {
				// 如果当前节点开头就是行尾，尝试向后取一个字符（通常不会发生，除非是空行）
				if (targetOffset + 1 <= targetNode.textContent!.length) {
					range.setEnd(targetNode, targetOffset + 1)
				}
			}
			rect = range.getBoundingClientRect()
		}

		return rect
	} catch (e) {
		console.error('Failed to get rect:', e)
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
			let n = 0
			if (text[i] === '\n') {
				n = i
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
