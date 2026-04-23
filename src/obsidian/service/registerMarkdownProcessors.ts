import {
	MarkdownPostProcessorContext,
	MarkdownView,
	parseFrontMatterEntry,
	parseFrontMatterStringArray,
} from 'obsidian'
import ClickCopyBlock from '../component/ClickCopyBlock'
import { parseM3u8Video } from '../../util/m3u8Utils'
import ColorGallery from '../component/ColorGallery'
import IconGallery from '../component/IconGallery'
import { createSpeakerBlock } from '../../cyu/createSpeakerBlock'
import CyuToolkitPlugin from '../../main'
import { wrapExternalImages } from './wrapExternalImages'

/**
 * Single entry-point for all `registerMarkdownPostProcessor` calls.
 * Keeps main.ts free of per-feature logic.
 */
export function registerMarkdownProcessors(plugin: CyuToolkitPlugin) {
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
	})

	// 3. Shared per-element processor (images, m3u8, TTS)
	plugin.registerMarkdownPostProcessor(
		(el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			// Wrap external <img> in <span> (skip if opted out via frontmatter)
			const skipImageWrap = parseFrontMatterEntry(
				ctx.frontmatter,
				'ignore-modify-external-image'
			) as boolean | null
			if (!skipImageWrap) wrapExternalImages(el)

			// Parse .m3u8 video sources
			if (settings.enable_parse_m3u8) parseM3u8Video(el)

			// Click-to-pronounce TTS
			createSpeakerBlock(el)
		}
	)
}
