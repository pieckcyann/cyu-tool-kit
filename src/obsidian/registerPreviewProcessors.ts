import {
	MarkdownPostProcessorContext,
	MarkdownView,
	parseFrontMatterEntry,
	parseFrontMatterStringArray,
} from 'obsidian'
import ClickCopyBlock from '../cyu/ClickCopyBlock'
import { parseM3u8Video } from './service/m3u8Transformer'
import ColorGallery from '../cyu/ColorGallery'
import IconGallery from '../cyu/IconGallery'
import { createSpeakerBlock } from './service/createSpeakerBlock'
import CyuToolkitPlugin from './../main'
import FontGallery from '../cyu/FontGallery'
import { TimeTagChild } from '../cyu/time-tag/TimeTagChild'
import { inlineCodeHighlighter } from '../cyu/inline-code-highlight/inlineCodeHighlighter'

/**
 * Single entry-point for all `registerMarkdownPostProcessor` calls.
 * Keeps main.ts free of per-feature logic.
 *
 * Registers a post processor, to change how the document looks in reading mode.
 */
export function registerPreviewProcessors(plugin: CyuToolkitPlugin) {
	const { app, settings } = plugin

	plugin.registerMarkdownPostProcessor((el, ctx) => {
		const view = app.workspace.getActiveViewOfType(MarkdownView)
		if (!view) return

		// Time tag hint
		ctx.addChild(new TimeTagChild(el, ctx))

		// Click-copy blocks
		ctx.addChild(new ClickCopyBlock(settings, el))

		// Color galleries
		if (ctx.sourcePath === settings.folder_color_gallery) {
			ctx.addChild(new ColorGallery(settings, el))
		}

		// Icon galleries
		if (ctx.sourcePath === settings.folder_icon_gallery) {
			ctx.addChild(new IconGallery(settings, el))
		}

		if (ctx.sourcePath === settings.folder_font_gallery) {
			ctx.addChild(new FontGallery(app, settings, el, ctx))
		}
	})

	// 	plugin.registerEvent(
	// 		app.workspace.on('layout-change', () => {
	// 			const activeView = app.workspace.getActiveViewOfType(MarkdownView)
	// 			if (!activeView) return
	// 			timeTag?.reload()
	// 		})
	// 	)

	// Shared per-element processor (images, m3u8, TTS)
	plugin.registerMarkdownPostProcessor(
		(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			// 为网络图片也设置一层 div
			const skipImageWrap = parseFrontMatterEntry(
				ctx.frontmatter,
				'ignore-modify-external-image'
			) as boolean | null
			if (!skipImageWrap) wrapExternalImages(el)

			// 正确播放 m3u8 视频标签
			if (settings.enable_parse_m3u8) parseM3u8Video(el)

			// 单词发音
			createSpeakerBlock(el)

			// 表格设置
			processTableFlags(el)

			inlineCodeHighlighter(el)

			// processHeadingPrefix(el)
		}
	)
}

function processHeadingPrefix(container: HTMLElement) {
	const wrappers = container.findAllSelf('.el-h3')

	wrappers.forEach((wrapper) => {
		const heading = wrapper.querySelector('h3')
		if (!heading) return

		// 遍历子节点找到第一个非空的文本节点
		let textNode = null
		for (const node of heading.childNodes) {
			if (node.nodeType === Node.TEXT_NODE && node?.textContent?.trim() !== '') {
				textNode = node
				break
			}
		}

		if (textNode) {
			const content = textNode?.textContent?.trim()
			if (!content) return
			const match = content.match(/^(\d+(?:\.\d+)?)\s*(.*)/)

			if (match) {
				const [_, prefixText, titleText] = match

				console.log('prefixText:', prefixText)

				// 1. 更新原标题文本：删掉前缀数字
				textNode.textContent = ' ' + titleText

				// 2. 在父容器下创建/更新前缀（确保只加一次）
				let prefixSpan = wrapper.querySelector('.heading-prefix')
				if (!prefixSpan) {
					prefixSpan = document.createElement('span')
					prefixSpan.className = 'heading-prefix'
					// 挂在父容器的最前面
					wrapper.prepend(prefixSpan)
				}
				prefixSpan.textContent = prefixText

				// 给父容器加个类名方便样式控制
				wrapper.classList.add('has-hanging-prefix')
			}
		}
	})
}

function processTableFlags(container: HTMLElement): void {
	// 1. 找到当前容器下的所有表格
	const tables = container.querySelectorAll('table')

	tables.forEach((table: HTMLTableElement) => {
		// 2. 处理表格级 flag（只看第一个 th）
		const firstTh = table.querySelector('th')
		if (firstTh) {
			const firstChild = firstTh.firstChild

			if (firstChild && firstChild.nodeType === Node.TEXT_NODE) {
				const text = firstChild.textContent || ''

				// 语法符号与类名的映射关系
				const flags: Record<string, string> = {
					'-': 'table-not-full-width', // 不全宽
					'~': 'table-half-full-width', // 半全宽
					// '/': 'table-', //
					// '!': 'table-important', // 高亮显式
					// '^': 'table-narrow', // 紧凑模式
				}

				const firstChar = text.trimStart()[0]

				if (flags[firstChar]) {
					table.classList.add(flags[firstChar])

					// 只移除开头 flag
					firstChild.textContent = text.replace(/^\s*[-~]/, '').trimStart()
				}
			}
		}

		// 3. 处理第一行每列的 [数字] 宽度语法
		const firstRow = table.rows[0]
		if (!firstRow) return

		Array.from(firstRow.cells).forEach((cell, colIndex) => {
			const firstChild = cell.firstChild
			if (!firstChild || firstChild.nodeType !== Node.TEXT_NODE) return

			const text = firstChild.textContent || ''

			// 匹配开头的 [数字]，允许用 \[数字] 转义
			const escapedMatch = text.match(/^\s*\\\[(\d+)\]/)
			if (escapedMatch) {
				// 只是去掉转义符，不设置宽度
				firstChild.textContent = text.replace(/^\s*\\(?=\[\d+\])/, '').trimStart()
				return
			}

			const match = text.match(/^\s*\[(\d+)\]/)
			if (!match) return

			const width = Number(match[1])

			Array.from(table.rows).forEach((row) => {
				const targetCell = row.cells[colIndex]
				if (targetCell) {
					targetCell.style.width = `${width}px`
				}
			})

			firstChild.textContent = text.replace(/^\s*\[\d+\]/, '').trimStart()
		})
	})
}

/**
 * Wraps external `<img referrerpolicy>` elements in a `<span>` so they can
 * be styled/identified independently from internal Obsidian images.
 *
 * Skips:
 *  - Images already inside a `<span>`
 *  - Images with the `.banner-image` class (used by the Banners plugin)
 */
function wrapExternalImages(container: HTMLElement): void {
	const imgs = container.findAll('img[referrerpolicy]') as HTMLImageElement[]

	for (const img of imgs) {
		if (img.classList.contains('banner-image')) continue
		if (img.parentNode instanceof HTMLSpanElement) continue

		const span = document.createElement('span')
		span.id = 'external-link-image'
		span.classList.add('image-embed')

		const src = img.getAttribute('src')
		const alt = img.alt

		if (src) span.setAttribute('src', src)
		if (alt) span.setAttribute('alt', alt.split('|')[1] ?? alt)

		img.parentNode?.insertBefore(span, img)
		span.appendChild(img)
	}
}
