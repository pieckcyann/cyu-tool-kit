import { foldEffect, foldService, syntaxTree } from '@codemirror/language'
import { Extension, StateEffect } from '@codemirror/state'
import { EditorView, ViewPlugin } from '@codemirror/view'

// 匹配条件：以 "> [!xxx]- " 开头的行（模拟 Obsidian 的 Callout 折叠语法）
// 正则解释：以 > 开头，紧跟 [!任意字符]，且后面跟着一个减号 -
const calloutFoldRegex = /^>\s*\[!\w+\]-/

/**
 * 逻辑 1：提供折叠能力 (Fold Service)
 * 让侧边栏出现箭头，并定义点击箭头后折叠到哪里
 */
export const customFoldExtension: Extension = foldService.of(
	(state, lineStart, lineEnd) => {
		// 获取当前行的文本内容
		const line = state.doc.lineAt(lineStart)
		const text = line.text.trim()

		if (calloutFoldRegex.test(text)) {
			const doc = state.doc
			let foldEnd = line.to // 默认折叠到本行末尾

			// 向下寻找块引用的边界
			for (let i = line.number + 1; i <= doc.lines; i++) {
				const nextLine = doc.line(i)
				const nextText = nextLine.text.trim()

				// 如果下一行不再以 ">" 开头，说明块引用结束了
				if (!nextText.startsWith('>')) {
					foldEnd = doc.line(i - 1).to
					break
				}
				foldEnd = nextLine.to
			}

			// 返回折叠范围：从第一行的行尾 (line.to) 到 块结束的行尾 (foldEnd)
			return { from: line.to, to: foldEnd }
		}

		// 如果不满足条件，返回 null，不显示折叠箭头
		return null
	}
)

/**
 * 逻辑 2：初始化时自动折叠 (Auto Folder)
 * 这是一个 ViewPlugin，它在编辑器启动时扫描一次文档
 */
export const autoFoldPlugin = ViewPlugin.fromClass(
	class {
		constructor(view: EditorView) {
			// 在下一帧执行，确保文档已完全加载
			requestAnimationFrame(() => {
				this.foldAllTargetBlocks(view)
			})
		}

		foldAllTargetBlocks(view: EditorView) {
			const { state } = view
			const effects: StateEffect<unknown>[] = []

			for (let i = 1; i <= state.doc.lines; i++) {
				const line = state.doc.line(i)
				if (calloutFoldRegex.test(line.text.trim())) {
					// 利用刚才定义的 foldService 查找折叠范围
					// 注意：这里需要传入 line.from 作为起始搜索点
					const range = state.facet(foldService).reduce(
						(found, service) => {
							return found || service(state, line.from, line.to)
						},
						null as { from: number; to: number } | null
					)

					if (range) {
						effects.push(foldEffect.of(range))
					}
				}
			}

			if (effects.length > 0) {
				view.dispatch({ effects })
			}
		}
	}
)
