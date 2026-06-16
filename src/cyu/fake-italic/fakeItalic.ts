/**
 * 自定义斜体（fake italic）
 *
 * 用 `transform: skew()` 给 <em> 做几何切变倾斜——与字体无关、可任意角度，
 * 适用于字体既无 `slnt` 可变轴、也不响应 `font-style: oblique <角度>` 的场景。
 *
 * 由于 transform 对会换行的行内盒无效，必须把每个视觉行包成 `inline-block`
 * 单独倾斜，因此需要探测浏览器的换行点并按行切分。
 *
 * 本实现保留 <em> 内部的原始 DOM 结构（嵌套的 <strong>/<code>/链接等），
 * 切分通过 `Range.cloneContents()` 完成：它会把跨行的嵌套元素正确拆开并保留结构。
 *
 * 性能要点（阅读模式后处理器会随滚动按块反复触发）：
 *  1. 幂等：同一个 <em> 只初始化一次，绝不重复创建 ResizeObserver；
 *  2. 单行快速路径：绝大多数斜体只占一行，跳过逐字扫描；
 *  3. 每个容器只挂一个合并节流的 ResizeObserver；
 *  4. 整批 <em> 的读写严格分三段——先统一写、再统一测量、最后统一重建。绝不在
 *     循环里“写一次读一次”，否则每个 em 都会因上一个的写入触发一次强制同步重排
 *     （layout thrashing）。分段后无论多少个 em，整批只触发约一次重排。
 */

// 保存每个 <em> 的原始内容快照（含完整 DOM 结构），用于初始切分与尺寸变化时重排
const SNAPSHOTS = new WeakMap<HTMLElement, DocumentFragment>()

const FLAG = 'fakeItalicApplied'

export function applyFakeItalic(container: HTMLElement) {
	const elements = Array.from(container.querySelectorAll('em')) as HTMLElement[]
	if (elements.length === 0) return

	const fresh: HTMLElement[] = []
	for (const el of elements) {
		// 幂等：已处理过的 <em> 直接跳过（其容器的观察者仍存活，会负责后续重排）
		if (el.dataset[FLAG]) continue
		el.dataset[FLAG] = 'true'
		SNAPSHOTS.set(el, takeSnapshot(el))
		fresh.push(el)
	}

	// 本次没有新初始化任何 <em>，无需再挂观察者
	if (fresh.length === 0) return

	splitBatch(fresh) // 首次切分

	// 每个容器只挂一个合并节流的 ResizeObserver，宽度真正改变时整批重排
	let lastWidth = container.clientWidth
	let scheduled = false
	const observer = new ResizeObserver((entries) => {
		const currentWidth = entries[0]?.contentRect.width ?? container.clientWidth
		// 仅在容器宽度真正改变时触发，避免 inline-block 高度微调引发的死循环
		if (Math.abs(currentWidth - lastWidth) <= 1) return
		lastWidth = currentWidth
		if (scheduled) return
		scheduled = true
		requestAnimationFrame(() => {
			scheduled = false
			splitBatch(fresh)
		})
	})
	observer.observe(container)
}

/** 克隆 <em> 当前内容为一份独立快照（非破坏性，原节点保持不动） */
function takeSnapshot(el: HTMLElement): DocumentFragment {
	const frag = document.createDocumentFragment()
	el.childNodes.forEach((n) => frag.appendChild(n.cloneNode(true)))
	return frag
}

/**
 * 批量切分：读写分段，整批只触发约一次强制重排。
 */
function splitBatch(els: HTMLElement[]) {
	// 阶段 1（只写）：用原始快照还原内容，便于浏览器在真实结构上做流式排版测量
	for (const el of els) {
		const snap = SNAPSHOTS.get(el)
		if (!snap) continue
		el.textContent = ''
		el.appendChild(snap.cloneNode(true)) // 克隆，保持快照本身始终纯净
	}

	// 阶段 2（只读）：集中测量并切出每行的内容片段（保留嵌套结构）。
	// 全程不修改活动 DOM（切片基于快照克隆），故连续测量复用同一次布局
	const linesPerEl = els.map((el) => {
		const snap = SNAPSHOTS.get(el)
		return snap ? computeLineFragments(el, snap) : null
	})

	// 阶段 3（只写）：集中重建 DOM。不再读取布局，因此不触发同步重排
	els.forEach((el, i) => {
		const frags = linesPerEl[i]
		if (!frags) return
		const out = document.createDocumentFragment()
		for (const frag of frags) {
			const span = document.createElement('span')
			span.className = 'fake-italic-line'
			span.appendChild(frag)
			out.appendChild(span)
		}
		el.textContent = ''
		el.appendChild(out)
	})
}

interface CaretMap {
	nodes: Text[] // 按文档顺序收集的非空文本节点
	starts: number[] // 每个文本节点在拼接文本中的起始全局偏移
	total: number // 全部文本总长
}

/** 用 TreeWalker 收集 root 内所有文本节点，建立“全局字符偏移 → 节点/局部偏移”映射 */
function buildCaretMap(root: Node): CaretMap {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
	const nodes: Text[] = []
	const starts: number[] = []
	let total = 0
	let n: Node | null
	while ((n = walker.nextNode())) {
		const t = n as Text
		if (t.data.length === 0) continue
		nodes.push(t)
		starts.push(total)
		total += t.data.length
	}
	return { nodes, starts, total }
}

/** 把全局偏移 g 映射回具体的 (文本节点, 局部偏移)，供 Range 边界使用（二分查找） */
function caretAt(map: CaretMap, g: number): { node: Text; offset: number } {
	if (g <= 0) return { node: map.nodes[0], offset: 0 }
	const lastIdx = map.nodes.length - 1
	if (g >= map.total) return { node: map.nodes[lastIdx], offset: map.nodes[lastIdx].data.length }

	let lo = 0
	let hi = lastIdx
	let idx = 0
	while (lo <= hi) {
		const mid = (lo + hi) >> 1
		if (map.starts[mid] <= g) {
			idx = mid
			lo = mid + 1
		} else {
			hi = mid - 1
		}
	}
	const len = map.nodes[idx].data.length
	if (g <= map.starts[idx] + len) {
		return { node: map.nodes[idx], offset: g - map.starts[idx] }
	}
	// 落在节点之间（理论上不会发生），退到下一个节点起点
	const ni = Math.min(idx + 1, lastIdx)
	return { node: map.nodes[ni], offset: 0 }
}

/**
 * 计算 <em> 内容按视觉行切分后的内容片段数组（保留嵌套结构）。
 *
 * @param el       已还原为原始结构的活动 <em>（仅用于测量换行点）
 * @param snapshot <em> 的原始结构快照（每行片段从它的克隆上切出，保证结构完整）
 */
function computeLineFragments(el: HTMLElement, snapshot: DocumentFragment): DocumentFragment[] {
	const map = buildCaretMap(el)
	const range = document.createRange()

	// 无文本内容（如仅含 <img>）或单行：整体作为一行，直接用快照克隆（结构最完整）
	if (map.total === 0) {
		return [snapshot.cloneNode(true) as DocumentFragment]
	}

	const first = map.nodes[0]
	const last = map.nodes[map.nodes.length - 1]
	range.setStart(first, 0)
	range.setEnd(last, last.data.length)

	// 单行快速路径：getClientRects 对跨行 Range 会按行返回多个矩形，单行 ⇒ ≤1 个
	if (range.getClientRects().length <= 1) {
		return [snapshot.cloneNode(true) as DocumentFragment]
	}

	const breaks = computeLineBreaks(map, range)
	const frags: DocumentFragment[] = []
	for (let k = 0; k < breaks.length; k++) {
		const startG = breaks[k]
		const endG = k + 1 < breaks.length ? breaks[k + 1] : map.total
		frags.push(sliceLine(snapshot, startG, endG, map.total))
	}
	return frags
}

/**
 * 从快照克隆中切出全局区间 [startG, endG) 的内容，保留完整嵌套结构。
 *
 * 关键：不能用“文本节点级端点 + cloneContents”，因为当整行落在单个嵌套元素内时，
 * Range 的公共祖先会是文本节点本身，cloneContents 不会包含其上的 <code>/<span> 包裹层。
 * 改为克隆整份内容、再用 deleteContents 删掉头尾——此时公共祖先始终是整个片段，包裹得以保留。
 */
function sliceLine(
	snapshot: DocumentFragment,
	startG: number,
	endG: number,
	total: number
): DocumentFragment {
	const clone = snapshot.cloneNode(true) as DocumentFragment
	if (startG <= 0 && endG >= total) return clone

	const map = buildCaretMap(clone)
	if (map.total === 0) return clone

	const range = document.createRange()
	const first = map.nodes[0]
	const last = map.nodes[map.nodes.length - 1]

	// 先删尾 [endG, total)，再删头 [0, startG)：先删尾不会影响头部节点与偏移
	if (endG < total) {
		const e = caretAt(map, endG)
		range.setStart(e.node, e.offset)
		range.setEnd(last, last.data.length)
		range.deleteContents()
	}
	if (startG > 0) {
		const s = caretAt(map, startG)
		range.setStart(first, 0)
		range.setEnd(s.node, s.offset)
		range.deleteContents()
	}
	return clone
}

/**
 * 逐字探测换行点，返回各视觉行的起始全局偏移（连续切分，不丢字符）。
 * 全程只读 getClientRects，无 DOM 写入，故整段循环只触发约一次布局计算。
 */
function computeLineBreaks(map: CaretMap, range: Range): number[] {
	const breaks = [0]
	let lineStart = 0
	let lastBottom = -1

	for (let g = 0; g <= map.total; g++) {
		const a = caretAt(map, lineStart)
		const b = caretAt(map, g)
		range.setStart(a.node, a.offset)
		range.setEnd(b.node, b.offset)

		const rects = range.getClientRects()
		if (rects.length === 0) continue

		const currentBottom = rects[rects.length - 1].bottom
		if (lastBottom === -1) {
			lastBottom = currentBottom
		} else if (currentBottom - lastBottom > 5) {
			// 当前字底部明显下移，说明前一个字符处发生了换行
			breaks.push(g - 1)
			lineStart = g - 1
			lastBottom = currentBottom
		}
	}
	return breaks
}
