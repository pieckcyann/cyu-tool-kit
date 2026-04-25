import { MarkdownPostProcessorContext } from 'obsidian'
import { AnnotationChild } from '../cyu/arrow_annotation/AnnotationChild'
import CyuToolkitPlugin from '../main'

export function registerCodeblockProcessors(plugin: CyuToolkitPlugin) {
	const { app, settings } = plugin

	// 箭头注解代码块
	plugin.registerMarkdownCodeBlockProcessor(
		'annotation',
		(src: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			ctx.addChild(new AnnotationChild(plugin.app, el, src, ctx))
		},
		// 优先级设低一点，确保目标块已经渲染完毕
		100
	)
}
