// renderer.ts
import rough from 'roughjs'
import { hashString } from '../../util/cyuUtil'

export type HighlightType = 'circle' | 'wave' | 'none'

export interface ArrowTarget {
	labelRect: DOMRect
	lineRect: DOMRect // 整行 rect (fallback / line 模式用)
	lineTag: String
	textRect: DOMRect | null // Range 精确 rect (null = line 模式)
	side: 'left' | 'right'
	containerRect: DOMRect
	highlightType: HighlightType
	seed: string
	labelEl: HTMLElement // 对应的 label DOM 元素，用于 hover 联动
}

const SVG_NS = 'http://www.w3.org/2000/svg'
const MARKER_ID = 'annotation-arrow-head'
const MARKER_ACTIVE_ID = 'annotation-arrow-head-active'

const BREAK_THRESHOLD = 200 // 超过此水平距离视为"远距离"，启用断线模式(px)
const STUB_LENGTH = 36 // 断线模式下，标签侧的短线长度(px)

// ─── 工具 ─────────────────────────────────────────────────────────────────────

// 为线段添加微扰,模拟手绘
function seededJitter(seed: string, index: number): number {
	let h = index * 2654435761
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i)
		h = Math.imul(h, 0x9e3779b9)
		h ^= h >>> 16
	}
	return ((h >>> 0) / 0xffffffff) * 2 - 1
}

function toLocal(cr: DOMRect, x: number, y: number) {
	return { x: x - cr.left, y: y - cr.top }
}

/**
 * 箭头路径构建算法
 * @param start
 * @param end
 * @param side
 * @param seed
 * @returns 路径样式属性
 */
function buildCurvePath(
	start: { x: number; y: number },
	end: { x: number; y: number },
	side: 'left' | 'right',
	seed: string
): string {
	const dx = Math.abs(end.x - start.x)
	const cpOffset = Math.max(dx * 0.42, 20) + seededJitter(seed, 0) * 5
	const cp1x = side === 'left' ? start.x + cpOffset : start.x - cpOffset
	const cp2x = side === 'left' ? end.x - cpOffset : end.x + cpOffset
	// const cp1y = start.y + seededJitter(seed, 1) * 4
	// const cp2y = end.y + seededJitter(seed, 2) * 4
	const cp1y = start.y + (end.y - start.y) * 0.25 + seededJitter(seed, 1) * 4
	const cp2y = end.y - (end.y - start.y) * 0.15 + seededJitter(seed, 2) * 4
	return `M ${start.x},${start.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${end.x},${end.y}`
}

// ─── 核心绘制函数 ─────────────────────────────────────────────────────────────────

/**
 * 短文本画手绘圈，返回箭头应指向的点（圈的左/右侧中点，已转为 local 坐标）
 * 亮绘制 (返回箭头终点 + 生成的 SVG 元素)
 * @param parent
 * @param target
 * @param textRect
 * @returns
 */

function drawCircle(
	parent: SVGElement,
	target: ArrowTarget
): { x: number; y: number; el: SVGElement } {
	const textRect = target.textRect!!
	const lineTag = target.lineTag

	let roughness = 1
	let strokeWidth = 1.4
	if (lineTag == 'CODE') {
		roughness = 0.2
		strokeWidth = 1
	}
	// console.log('lineTag:', lineTag)

	const cr = target.containerRect
	const pad = 6 // 增加间距让圈看起来更从容

	// 计算相对于容器的坐标
	const x = textRect.left - cr.left - pad
	const y = textRect.top - cr.top - pad
	const w = textRect.width + pad * 2
	const h = textRect.height + pad * 2

	const cx = x + w / 2
	const cy = y + h / 2

	// 初始化 Rough SVG 实例
	const rc = rough.svg(parent as unknown as SVGSVGElement)

	// 配置手绘参数
	const node = rc.ellipse(cx, cy, w, h, {
		seed: hashString(target.seed), // 使用传入的 seed 保持确定性渲染
		stroke: '#8b5e3c', // 用深棕色或炭灰色模拟手绘笔触
		strokeWidth: 1.4,
		roughness, // 粗糙度：值越大线越乱，针对长文本建议 1.5 - 2.0
		bowing: 1.5, // 弯曲度：模拟画长线时的弧度偏离
		// disableMultiStroke: false, // 双线效果
	})

	// 增强交互性
	// Rough.js 生成的是一个 <g> 标签，里面包含多个 <path>
	node.classList.add('ann-highlight')
	node.style.pointerEvents = 'stroke'

	parent.appendChild(node)

	// 计算返回给箭头的连接点
	const endX = target.side === 'left' ? x : x + w

	return {
		x: endX,
		y: cy,
		el: node as unknown as SVGElement,
	}
}

/**
 * 优化后的手绘圈函数
 */
// function drawCircle(
// 	parent: SVGElement,
// 	t: ArrowTarget,
// 	rect: DOMRect
// ): { x: number; y: number; el: SVGElement } {
// 	const cr = t.containerRect
// 	const pad = 6 // 稍微增大边距
// 	const x = rect.left - cr.left - pad
// 	const y = rect.top - cr.top - pad
// 	const w = rect.width + pad * 2
// 	const h = rect.height + pad * 2
// 	const cx = x + w / 2
// 	const cy = y + h / 2
//
// 	const path = document.createElementNS(SVG_NS, 'path')
//
// 	// 配置参数
// 	const rx = w / 2
// 	const ry = h / 2
// 	const segments = 16 // 离散线段数量
// 	const bow = 2 // 弯曲度抖动
// 	const overlap = 0.4 // 结尾重叠的弧度（约20-30度）
//
// 	let d = ''
//
// 	// 生成手绘路径：
// 	// 我们跑两次循环，或者一次循环超过 2*PI，来模拟那种“画了两笔”或“首尾相接不准”的感觉
// 	const totalAngle = Math.PI * 2 + overlap
// 	const points: { x: number; y: number }[] = []
//
// 	for (let i = 0; i <= segments; i++) {
// 		const angle = (i / segments) * totalAngle
//
// 		// 核心：在椭圆轨道上加入随机抖动
// 		const jitterX = seededJitter(t.seed, i) * bow
// 		const jitterY = seededJitter(t.seed, i + 100) * bow
//
// 		const px = cx + rx * Math.cos(angle) + jitterX
// 		const py = cy + ry * Math.sin(angle) + jitterY
//
// 		points.push({ x: px, y: py })
// 	}
//
// 	// 将点转换为平滑的卡特姆罗尔(Catmull-Rom)曲线或简单的贝塞尔
// 	// 这里为了简单和性能，使用连续的二次贝塞尔 Q
// 	d = `M ${points[0].x},${points[0].y}`
// 	for (let i = 1; i < points.length - 1; i++) {
// 		const xc = (points[i].x + points[i + 1].x) / 2
// 		const yc = (points[i].y + points[i + 1].y) / 2
// 		d += ` Q ${points[i].x},${points[i].y} ${xc},${yc}`
// 	}
// 	// 最后一段
// 	d += ` L ${points[points.length - 1].x},${points[points.length - 1].y}`
//
// 	path.setAttribute('d', d)
// 	path.setAttribute('fill', 'none')
// 	path.setAttribute('stroke-width', '1.6')
// 	path.setAttribute('stroke-linecap', 'round')
// 	path.setAttribute('stroke-linejoin', 'round')
// 	path.classList.add('ann-highlight')
//
// 	path.style.pointerEvents = 'stroke'
// 	parent.appendChild(path)
//
// 	const endX = t.side === 'left' ? x - 2 : x + w + 2
// 	return { x: endX, y: cy, el: path }
// }

/**
 * 长段文本的波浪线
 * @param parent
 * @param t
 * @param rect
 * @returns
 */
function drawWave(
	parent: SVGElement,
	t: ArrowTarget,
	rect: DOMRect
): { x: number; y: number; el: SVGElement } {
	const cr = t.containerRect
	const x = rect.left - cr.left
	const y = rect.top - cr.top
	const w = rect.width
	const waveY = y + rect.height + 3
	const segments = Math.max(3, Math.round(w / 10))
	const step = w / segments

	let d = `M ${x},${waveY}`
	for (let i = 0; i < segments; i++) {
		const cx1 = x + step * i + step * 0.25
		const cy1 = waveY + 3
		const cx2 = x + step * i + step * 0.75
		const cy2 = waveY - 3
		d += ` C ${cx1},${cy1} ${cx2},${cy2} ${x + step * (i + 1)},${waveY}`
	}

	const path = document.createElementNS(SVG_NS, 'path')
	path.setAttribute('d', d)
	path.setAttribute('fill', 'none')
	path.setAttribute('stroke-width', '1.4')
	path.setAttribute('stroke-linecap', 'round')
	path.classList.add('ann-highlight')
	path.style.pointerEvents = 'stroke'
	parent.appendChild(path)

	const endX = t.side === 'left' ? x : x + w
	return { x: endX, y: waveY, el: path }
}

// ─── 主渲染 ───────────────────────────────────────────────────────────────────

export function renderArrows(container: HTMLElement, targets: ArrowTarget[]): void {
	container.querySelector('.annotation-svg-overlay')?.remove()
	if (targets.length === 0) return

	const w = container.offsetWidth
	const h = container.offsetHeight

	const svg = document.createElementNS(SVG_NS, 'svg')
	svg.classList.add('annotation-svg-overlay')
	svg.setAttribute('width', String(w))
	svg.setAttribute('height', String(h))
	svg.setAttribute('viewBox', `0 0 ${w} ${h}`)
	// SVG 本身 pointer-events: none，各元素按需开启
	svg.style.cssText =
		'position:absolute;top:0;left:0;pointer-events:none;overflow:visible;z-index:10'

	const defs = document.createElementNS(SVG_NS, 'defs')
	defs.innerHTML = `
        <marker id="${MARKER_ID}" markerWidth="8" markerHeight="8"
                refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M 0,0 L 6,3 L 0,6 Z"
                  fill="var(--annotation-arrow-color, var(--text-muted))"/>
        </marker>
        <marker id="${MARKER_ACTIVE_ID}" markerWidth="8" markerHeight="8"
                refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
            <path d="M 0,0 L 6,3 L 0,6 Z"
                  fill="var(--annotation-arrow-active-color, var(--text-accent))"/>
        </marker>
    `
	svg.appendChild(defs)

	for (const t of targets) {
		const cr = t.containerRect
		const pad = 5

		// 每条注释一个 group，仅 highlight 和 connector 元素开启 pointer-events
		const group = document.createElementNS(SVG_NS, 'g')
		group.classList.add('ann-group')
		group.style.pointerEvents = 'none' // group 本身 none，子元素按需开启

		// 计算起点
		const labelMidY = t.labelRect.top + t.labelRect.height / 2
		const startRawX = t.side === 'left' ? t.labelRect.right + pad : t.labelRect.left - pad
		const start = toLocal(cr, startRawX, labelMidY)

		// 计算终点 & 绘制 highlight
		let endPoint: { x: number; y: number }
		let highlightEl: SVGElement | null = null

		if (t.highlightType === 'circle' && t.textRect) {
			const res = drawCircle(group, t)
			endPoint = { x: res.x, y: res.y }
			highlightEl = res.el
		} else if (t.highlightType === 'wave' && t.textRect) {
			const res = drawWave(group, t, t.textRect)
			endPoint = { x: res.x, y: res.y }
			highlightEl = res.el
		} else {
			const lineLocal = toLocal(cr, t.lineRect.left, t.lineRect.top)
			endPoint =
				t.side === 'left'
					? { x: lineLocal.x - 4, y: lineLocal.y + t.lineRect.height / 2 }
					: {
							x: lineLocal.x + t.lineRect.width + 4,
							y: lineLocal.y + t.lineRect.height / 2,
						}
		}

		const hDist = Math.abs(endPoint.x - start.x)
		const isBreak = hDist > BREAK_THRESHOLD

		if (!isBreak) {
			// ── 近距离：贝塞尔，整条线可 hover ──
			const d = buildCurvePath(start, endPoint, t.side, t.seed)
			const path = document.createElementNS(SVG_NS, 'path')
			path.setAttribute('d', d)
			path.setAttribute('fill', 'none')
			path.setAttribute('stroke-width', '1.5')
			path.setAttribute('stroke-linecap', 'round')
			path.setAttribute('stroke-linejoin', 'round')
			path.setAttribute('marker-end', `url(#${MARKER_ID})`)
			path.setAttribute('pathLength', '100')
			path.classList.add('ann-connector', 'ann-connector-full')
			// path.style.pointerEvents = 'stroke' // 只有描边区域响应
			group.appendChild(path)
		} else {
			// ── 远距离：stub（无 pointer-events）+ 目标侧短箭头（可 hover）──

			// stub：pointer-events 完全关闭，真正"消失"
			const curveDrop = seededJitter(t.seed, 3) * 3
			const stubEndX = t.side === 'left' ? start.x + STUB_LENGTH : start.x - STUB_LENGTH
			const gradId = `ann-fade-${CSS.escape(t.seed)}`

			// gradient 定义
			const grad = document.createElementNS(SVG_NS, 'linearGradient')
			grad.setAttribute('id', gradId)
			grad.setAttribute('gradientUnits', 'userSpaceOnUse')
			grad.setAttribute('x1', String(start.x))
			grad.setAttribute('y1', String(start.y))
			grad.setAttribute('x2', String(stubEndX))
			grad.setAttribute('y2', String(start.y + curveDrop))
			const s1 = document.createElementNS(SVG_NS, 'stop')
			s1.setAttribute('offset', '0%')
			s1.setAttribute('stop-color', 'var(--annotation-arrow-color, var(--text-muted))')
			s1.setAttribute('stop-opacity', '0.85')
			const s2 = document.createElementNS(SVG_NS, 'stop')
			s2.setAttribute('offset', '100%')
			s2.setAttribute('stop-color', 'var(--annotation-arrow-color, var(--text-muted))')
			s2.setAttribute('stop-opacity', '0')
			grad.appendChild(s1)
			grad.appendChild(s2)
			defs.appendChild(grad)

			const stub = document.createElementNS(SVG_NS, 'path')
			stub.setAttribute(
				'd',
				`M ${start.x},${start.y} C ${start.x + (t.side === 'left' ? 12 : -12)},${start.y} ${stubEndX},${start.y + curveDrop} ${stubEndX},${start.y + curveDrop}`
			)
			stub.setAttribute('fill', 'none')
			stub.setAttribute('stroke', `url(#${gradId})`)
			stub.setAttribute('stroke-width', '1.5')
			stub.setAttribute('stroke-linecap', 'round')
			stub.classList.add('ann-connector', 'ann-connector-stub')
			stub.style.pointerEvents = 'none' // ← 关键：stub 完全不响应鼠标
			group.appendChild(stub)

			// 目标侧短箭头：可 hover (冒泡激活整组)
			const arrowLen = 16
			const arrowStartX =
				t.side === 'left' ? endPoint.x - arrowLen : endPoint.x + arrowLen
			const arrowPath = document.createElementNS(SVG_NS, 'path')
			arrowPath.setAttribute(
				'd',
				`M ${arrowStartX},${endPoint.y} L ${endPoint.x},${endPoint.y}`
			)
			arrowPath.setAttribute('fill', 'none')
			arrowPath.setAttribute('stroke-width', '1.5')
			arrowPath.setAttribute('stroke-linecap', 'round')
			arrowPath.setAttribute('marker-end', `url(#${MARKER_ID})`)
			arrowPath.setAttribute('pathLength', '100')
			arrowPath.classList.add('ann-connector', 'ann-connector-full')
			arrowPath.style.pointerEvents = 'stroke'
			group.appendChild(arrowPath)
		}

		svg.appendChild(group)
		setupHover(group, t.labelEl)
	}

	if (getComputedStyle(container).position === 'static') {
		container.style.position = 'relative'
	}
	container.appendChild(svg)
}

// ─── Hover 联动 ───────────────────────────────────────────────────────────────

function setupHover(group: SVGElement, labelEl: HTMLElement) {
	let count = 0

	const on = () => {
		if (++count !== 1) return
		group.classList.add('active')
		// label：找到内部实际渲染的子元素加样式，兼容 MarkdownRenderer 输出
		applyLabelActive(labelEl, true)
		group.querySelectorAll<SVGElement>('[marker-end]').forEach((el) => {
			el.setAttribute('marker-end', `url(#${MARKER_ACTIVE_ID})`)
		})
	}

	const off = () => {
		if (--count !== 0) return
		group.classList.remove('active')
		applyLabelActive(labelEl, false)
		group.querySelectorAll<SVGElement>('[marker-end]').forEach((el) => {
			el.setAttribute('marker-end', `url(#${MARKER_ID})`)
		})
	}

	// SVG 侧：只有开启了 pointer-events 的子元素会触发，冒泡到 group
	// group 自身 pointer-events:none，所以要监听 svg 的父容器事件？
	// 不——改为监听各个可交互子元素的事件，统一 dispatch 到 group
	group
		.querySelectorAll<SVGElement>('.ann-connector-full, .ann-highlight')
		.forEach((el) => {
			el.addEventListener('mouseenter', on)
			el.addEventListener('mouseleave', off)
		})

	// label DOM 侧
	labelEl.addEventListener('mouseenter', on)
	labelEl.addEventListener('mouseleave', off)
}

/**
 * MarkdownRenderer 渲染后 labelEl 内部是 p/span/strong 等元素。
 * outline 加在容器上会被内容遮挡，改用 box-shadow 并直接操作容器，
 * 同时给内部第一层子元素也加类，确保视觉反馈可见。
 */
function applyLabelActive(labelEl: HTMLElement, active: boolean) {
	labelEl.classList.toggle('ann-label-active', active)
	// 同时给直接子元素加类，应对 MarkdownRenderer 可能加的 wrapper
	for (const child of Array.from(labelEl.children) as HTMLElement[]) {
		child.classList.toggle('ann-label-active-inner', active)
	}
}
