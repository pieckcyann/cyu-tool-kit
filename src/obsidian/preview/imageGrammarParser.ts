import { scrollPastEnd } from '@codemirror/view'
import { capitalize, splitWithEscape } from '../../util/cyuUtil'
import { Notice } from 'obsidian'

const PARSERD_FLAG = 'ctk-image-parserd'
export function imageGrammarParser(container: HTMLElement) {
	fixImageStyles(container)

	// const imgSpans = container.findAll('span.image-embed') as HTMLSpanElement[]
	const imgSpans = container.findAll(
		'span.internal-embed, span.external-embed'
		// '.image-embed'
	) as HTMLSpanElement[]
	// console.log('container:', container.innerHTML)
	if (!imgSpans || imgSpans.length <= 0) return

	imgSpans.forEach((imgSpan) => {
		if (imgSpan.classList.contains(PARSERD_FLAG)) return
		const imgElem = imgSpan.find('img') as HTMLImageElement

		// 如果在处理器里找不到 img，说明它是个延时加载的内链图片
		if (!imgElem) {
			// 监听它的子节点变化，当 img 真正被 Obsidian 塞进去时再触发解析
			const observer = new MutationObserver((mutations, obs) => {
				const realImg = imgSpan.querySelector('img')
				if (realImg) {
					const context = _ParserInfo(imgSpan, realImg)
					$ParserFloatFlag(context)
					$ParserHeading(context)
					obs.disconnect() // 停止监听
				}
			})
			observer.observe(imgSpan, { childList: true })
			return
		}

		const context = _ParserInfo(imgSpan, imgElem)
		$ParserFloatFlag(context)
		$ParserHeading(context)
		// $ApplyImageGridLayout(container)
		imgSpan.classList.add(PARSERD_FLAG)
	})
}

/**
 * 修复一些小样式
 */
function fixImageStyles(container: HTMLElement) {
	/* - 删掉 [[图片链接|标题|数字]] 中的 “|数字” 部分 */
	// const inLink = container.querySelector('a.internal-link')
	const links = container.querySelectorAll<HTMLLinkElement>(
		'a.internal-link, a.external-link'
	)

	links.forEach((link) => {
		if (link && link.textContent) {
			const originalText = link.textContent
			const lastIndex = originalText.lastIndexOf('|')

			if (lastIndex !== -1) {
				const cleanedText = originalText.slice(0, lastIndex).replace('#nomix|', '')
				link.textContent = cleanedText
			}
		}
	})
}

interface Context {
	isInternal: boolean
	spanEle: HTMLSpanElement
	spanSrc: string
	spanAlt: string
	imgEle: HTMLImageElement
	imgAlt: string
	imgSrc: string
}

const _ParserInfo = (span: HTMLSpanElement, img: HTMLImageElement): Context => {
	return {
		isInternal: span.classList.contains('internal-embed'),
		spanEle: span,
		spanSrc: span.getAttr('src') ?? '',
		spanAlt: span.getAttr('alt') ?? '',
		imgEle: img,
		imgAlt: img.alt,
		imgSrc: img.src,
	}
}

// - 浮动语法: #L #R #C 其他语法： #nomix
const $ParserFloatFlag = (context: Context) => {
	const { isInternal, spanEle, spanSrc, imgEle } = context
	let float: 'left' | 'right' | 'middle' = 'middle'
	let floatFlag: string | null = null
	if (isInternal) {
		/* 内链图片 */
		// const realSrc = isInternal ? (imgSpan.getAttr('src') ?? '') : imgSrc
		floatFlag = splitWithEscape(spanSrc, '#', '#').at(-1) ?? ''
		if (floatFlag === 'L') {
			float = 'left'
		} else if (floatFlag === 'R') {
			float = 'right'
		} else if (floatFlag === 'C') {
			float = 'middle'
		}
	} else {
		/* 外链图片 */
		// floatFlag = splitWithEscape(context.imgAlt, '|').at(0) ?? ''
		floatFlag = splitWithEscape(context.imgSrc, '#', '#').at(-1) ?? ''
		if (floatFlag == 'L') {
			float = 'left'
		} else if (floatFlag == 'R') {
			float = 'right'
		} else if (floatFlag == 'C') {
			float = 'middle'
		}
	}

	if (float != 'middle') {
		// spanEle.style.float = float
		// if (float == 'left') {
		// 	imgEle.style.marginRight = '0.8em'
		// } else {
		// 	imgEle.style.marginLeft = '0.8em'
		// }
		// spanEle.style[`margin${capitalize(float)}` as any] = '0.5em' // 跟文字隔点空

		spanEle.setAttribute('data-float', float)
	}

	// console.log('imgEle:', imgEle)
	// console.log('floatFlag:', floatFlag)
	// imgEle.setAttr('data-float-flag', floatFlag)

	if ((!isInternal && floatFlag == '#nomix') || (isInternal && floatFlag == 'nomix')) {
		// imgEle.style.mixBlendMode = 'normal'
		imgEle.setAttribute('data-nomix', 'true')
	}
}

// - 标题语法:
const $ParserHeading = (context: Context) => {
	const { spanEle, spanAlt, spanSrc } = context
	let title: string = ''
	if (context.isInternal) {
		/* 内链图片 */
		if (spanAlt != spanSrc) {
			if (spanSrc.endsWith('#nomix')) {
				if (spanAlt.replace(' > nomix', '') != spanSrc.replace('#nomix', '')) {
					title = spanAlt
				}
			} else {
				// 必须和图片名不一致，才能算作标题
				title = spanAlt
			}
		}
	} else {
		/* 外链图片 */
		title = splitWithEscape(context.imgAlt, '|').at(0) ?? ''
	}

	if (title) {
		const figcaption = spanEle.createEl('figcaption')
		figcaption.innerText = title
	}
}

/**
 * 将指定容器内符合条件的段落或列表项中的图片布局为网格
 * @param container 需要应用图片网格布局的根容器元素
 */
function $ApplyImageGridLayout(container: HTMLElement): void {
	const candidates = container.querySelectorAll('p, li')

	candidates.forEach((candidate) => {
		// 获取 candidate 内部所有符合图片选择器的元素
		const images = candidate.querySelectorAll(':scope > .image-embed')

		// 如果至少有两个图片，且它们都是 candidate 的直接子元素
		if (images.length >= 2) {
			// 应用网格样式
			;(candidate as HTMLElement).style.display = 'grid'
			;(candidate as HTMLElement).style.gridTemplateColumns =
				'repeat(auto-fit, minmax(0, 1fr))'
			;(candidate as HTMLElement).style.gridRowGap = '0'
			;(candidate as HTMLElement).style.gridColumnGap = 'var(--img-grid-gap, 0)'

			// 可选：删除图片后面的 <br> 元素（如果需要）
			const brElements = candidate.querySelectorAll(':scope > br')
			brElements.forEach((br) => br.remove())
		} else {
			// 如果不足两个图片，移除可能之前添加的网格样式（避免冲突）
			;(candidate as HTMLElement).style.display = ''
			;(candidate as HTMLElement).style.gridTemplateColumns = ''
			;(candidate as HTMLElement).style.gridRowGap = ''
			;(candidate as HTMLElement).style.gridColumnGap = ''
		}
	})
}
