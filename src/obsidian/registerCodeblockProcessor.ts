// registerCodeblockProcessor.ts
import { MarkdownPostProcessorContext, MarkdownView } from 'obsidian'
import { AnnotationChild } from '../cyu/arrow_annotation/AnnotationChild'
import CyuToolkitPlugin from '../main'

// sourcePath -> 上一个被渲染的块元素
const lastBlockRegistry = new Map<string, HTMLElement>()

// const CODE_LANGUAGE_NAME = 'annt'
export const CODE_LANGUAGE_NAME = 'cyu-annotation'

export function registerCodeblockProcessors(plugin: CyuToolkitPlugin) {
	const { app, settings } = plugin
	let annt: AnnotationChild | null
	// 箭头注解代码块
	// plugin.registerMarkdownCodeBlockProcessor(
	// 	'annt',
	// 	(src: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
	// 		ctx.addChild(new AnnotationChild(plugin.app, el, src, ctx))
	// 	},
	// 	// 优先级设低一点，确保目标块已经渲染完毕
	// 	100
	// )

	// 1. 全局 post processor，优先级高（数字小），先于 annt 块执行，负责记录"上一个块"
	plugin.registerMarkdownPostProcessor((el, ctx) => {
		// 跳过 annt 块自身，避免把自己记录为 target
		if (el.querySelector(`.language-${CODE_LANGUAGE_NAME}`)) return
		// console.log('el:', el)
		lastBlockRegistry.set(ctx.sourcePath, el)
	}, -100) // 优先级比 annt 的 100 高

	// 2. annt 块处理器，优先级低，晚于普通块执行
	plugin.registerMarkdownCodeBlockProcessor(
		CODE_LANGUAGE_NAME,
		(src, el, ctx) => {
			// 此时 lastBlockRegistry 里已经存着上一个块的 el
			const prevEl = lastBlockRegistry.get(ctx.sourcePath) ?? null
			annt = new AnnotationChild(plugin.app, el, src, ctx, prevEl)
			ctx.addChild(annt)
		},
		100
	)

	// view 关闭时清理，避免 stale 引用
	plugin.registerEvent(
		app.workspace.on('layout-change', () => {
			const openPaths = new Set(
				app.workspace
					.getLeavesOfType('markdown')
					.map((l) => (l.view as MarkdownView).file?.path)
					.filter(Boolean)
			)
			for (const path of lastBlockRegistry.keys()) {
				if (!openPaths.has(path)) {
					lastBlockRegistry.delete(path)
				}
			}
		})
	)
}
