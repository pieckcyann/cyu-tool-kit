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
import { TimeTagChild } from '../cyu/time_tag/TimeTagChild'

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
		}
	)
}

function processTableFlags(container: HTMLElement): void {
	// 1. 找到当前容器下的所有表格
	const tables = container.querySelectorAll('table')

	tables.forEach((table: HTMLTableElement) => {
		// 2. 定位第一个表头单元格 (th)
		const firstTh = table.querySelector('th')
		if (!firstTh) return

		// 3. 获取第一个文本节点（避免误伤嵌套的 HTML 标签）
		const firstChild = firstTh.firstChild
		if (!firstChild || firstChild.nodeType !== Node.TEXT_NODE) return

		const text = firstChild.textContent || ''

		// 4. 定义语法符号与类名的映射关系
		const flags: Record<string, string> = {
			'-': 'table-not-full-width', // 不全宽
			'~': 'table-half-full-width', // 半全宽
			// '/': 'table-', //
			// '!': 'table-important', // 高亮显式
			// '^': 'table-narrow', // 紧凑模式
		}

		// 5. 检查开头字符
		const firstChar = text.trimStart()[0]

		if (flags[firstChar]) {
			// 添加对应的类名
			table.classList.add(flags[firstChar])

			// 移除该符号：修改文本节点内容，保留剩余部分
			// 使用 replace 确保只删掉第一个匹配到的符号
			firstChild.textContent = text.replace(firstChar, '').trimStart()

			// 如果删掉符号后单元格空了，可以根据需要处理（通常保持原样即可）
		}
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
