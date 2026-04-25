/**
 * 用 Range API 在元素内精确定位文本
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
