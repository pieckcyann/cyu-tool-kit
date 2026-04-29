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
			ctx.addChild(new FontGallery(settings, el))
		}
	})

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
		}
	)
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
