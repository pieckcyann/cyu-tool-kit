export interface ArrowTarget {
	/** 注释标签元素的 bounding rect */
	labelRect: DOMRect
	/** 目标块中匹配行的 bounding rect */
	lineRect: DOMRect
	side: 'left' | 'right'
	/** 外层容器的 bounding rect，用于坐标转换 */
	containerRect: DOMRect
}

/**
 * 基于字符串 seed 的确定性伪随机，返回 [-1, 1] 的浮点数。
 * 用于给箭头曲线加入微小扰动，避免所有箭头形状完全一致，
 * 同时保证同一条注释每次渲染结果相同。
 */
function seededJitter(seed: string, index: number): number {
	let h = index * 2654435761
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i)
		h = Math.imul(h, 0x9e3779b9)
		h ^= h >>> 16
	}
	return ((h >>> 0) / 0xffffffff) * 2 - 1
}

/**
 * 构造 SVG cubic bezier 路径的 d 属性字符串。
 *
 * 控制点策略：
 * - 起点和终点都以水平方向出发/到达，曲线中间自然弯曲
 * - 控制点偏移量约为水平距离的 42%，配合 seededJitter 制造手绘感
 */
// 修改 buildArrowPath 增加安全边距，并修复偏移
export function buildArrowPath(t: ArrowTarget, seed: string): string {
	const cr = t.containerRect
	const padding = 5 // 连线离物体留出 5px 的呼吸感

	const toLocal = (x: number, y: number) => ({ x: x - cr.left, y: y - cr.top })

	const labelMidY = t.labelRect.top + t.labelRect.height / 2
	const lineMidY = t.lineRect.top + t.lineRect.height / 2

	let startX: number, endX: number
	if (t.side === 'left') {
		startX = t.labelRect.right + padding // 向外移一点
		endX = t.lineRect.left - padding
	} else {
		startX = t.labelRect.left - padding
		endX = t.lineRect.right + padding
	}

	const start = toLocal(startX, labelMidY)
	const end = toLocal(endX, lineMidY)

	const dx = Math.abs(end.x - start.x)
	// 即使 dx 极小，也保证 cpOffset 有个最小值，防止线段变直
	const cpOffset = Math.max(dx * 0.42, 15) + seededJitter(seed, 0) * 5

	let cp1x = t.side === 'left' ? start.x + cpOffset : start.x - cpOffset
	// 修复第二个控制点：应朝向目标反向弯曲，形成 S 型或自然弧度
	let cp2x = t.side === 'left' ? end.x - cpOffset : end.x + cpOffset

	const cp1y = start.y + seededJitter(seed, 1) * 4
	const cp2y = end.y + seededJitter(seed, 2) * 4

	return `M ${start.x},${start.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`
}

/**
 * 绘制手绘风格的圈或波浪线
 */
function drawHighlight(
	svg: SVGElement,
	t: ArrowTarget,
	type: 'circle' | 'wave',
	seed: string
) {
	const cr = t.containerRect
	const lr = t.lineRect
	const x = lr.left - cr.left
	const y = lr.top - cr.top
	const w = lr.width
	const h = lr.height

	const path = document.createElementNS(SVG_NS, 'path')
	let d = ''

	if (type === 'circle') {
		// 手绘圆圈：两段弧线拼接，略微不闭合增加真实感
		const pad = 3
		d = `M ${x - pad},${y + h / 2} 
             Q ${x - pad},${y - pad} ${x + w / 2},${y - pad} 
             T ${x + w + pad},${y + h / 2} 
             T ${x + w / 2},${y + h + pad} 
             T ${x - pad + 2},${y + h / 2 + 2}`
	} else {
		// 波浪线：在文本下方
		const waveY = y + h + 2
		const segments = 4
		const step = w / segments
		d = `M ${x},${waveY}`
		for (let i = 0; i < segments; i++) {
			const cx1 = x + step * i + step * 0.25
			const cy1 = waveY + 3
			const cx2 = x + step * i + step * 0.75
			const cy2 = waveY - 3
			const ex = x + step * (i + 1)
			d += ` C ${cx1},${cy1} ${cx2},${cy2} ${ex},${waveY}`
		}
	}

	path.setAttribute('d', d)
	path.setAttribute('fill', 'none')
	path.setAttribute('stroke', 'var(--annotation-arrow-color, var(--text-accent))')
	path.setAttribute('stroke-width', '1.2')
	path.setAttribute('opacity', '0.6')
	svg.appendChild(path)
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const MARKER_ID = 'annotation-arrow-head'

/**
 * 在 container 上叠加一个绝对定位的 SVG overlay，绘制所有箭头。
 * 每次调用前会移除旧的 overlay，避免重复叠加。
 */
export function renderArrows(
	container: HTMLElement,
	arrows: { target: ArrowTarget; seed: string }[]
): void {
	container.querySelector('.annotation-svg-overlay')?.remove()

	if (arrows.length === 0) return

	const svg = document.createElementNS(SVG_NS, 'svg')
	svg.classList.add('annotation-svg-overlay')

	const w = container.offsetWidth
	const h = container.offsetHeight
	svg.setAttribute('width', String(w))
	svg.setAttribute('height', String(h))
	svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
	svg.style.cssText = [
		'position:absolute',
		'top:0',
		'left:0',
		'pointer-events:none',
		'overflow:visible',
		'z-index:10',
	].join(';')

	// 定义箭头头部 marker，整个 SVG 共用一个
	const defs = document.createElementNS(SVG_NS, 'defs')
	const marker = document.createElementNS(SVG_NS, 'marker')
	marker.setAttribute('id', MARKER_ID)
	marker.setAttribute('markerWidth', '8')
	marker.setAttribute('markerHeight', '8')
	marker.setAttribute('refX', '6')
	marker.setAttribute('refY', '3')
	marker.setAttribute('orient', 'auto')
	marker.setAttribute('markerUnits', 'strokeWidth')

	const arrowHead = document.createElementNS(SVG_NS, 'path')
	arrowHead.setAttribute('d', 'M 0,0 L 6,3 L 0,6 Z')
	arrowHead.setAttribute('fill', 'var(--annotation-arrow-color, var(--text-muted))')

	marker.appendChild(arrowHead)
	defs.appendChild(marker)
	svg.appendChild(defs)

	for (const { target, seed } of arrows) {
		const d = buildArrowPath(target, seed)
		const path = document.createElementNS(SVG_NS, 'path')
		path.setAttribute('d', d)
		path.setAttribute('fill', 'none')
		path.setAttribute('stroke', 'var(--annotation-arrow-color, var(--text-muted))')
		path.setAttribute('stroke-width', '1.5')
		path.setAttribute('stroke-linecap', 'round')
		path.setAttribute('stroke-linejoin', 'round')
		path.setAttribute('marker-end', `url(#${MARKER_ID})`)
		svg.appendChild(path)
	}

	// 容器需要 position 非 static，否则绝对定位子元素无法正确定位
	if (getComputedStyle(container).position === 'static') {
		container.style.position = 'relative'
	}

	container.appendChild(svg)
}
