import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder } from '@codemirror/state'
import {
	Decoration,
	ViewPlugin,
	DecorationSet,
	ViewUpdate,
	EditorView,
} from '@codemirror/view'

/**
 * 源码模式插件：为 `{lang}内容` 语法添加 CSS 类
 */
export const InlineCodeHighlightViewPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet

		constructor(view: EditorView) {
			this.decorations = this.buildDecorations(view)
		}

		update(update: ViewUpdate) {
			// 仅在文档更改或滚动时更新
			if (update.docChanged || update.viewportChanged) {
				this.decorations = this.buildDecorations(update.view)
			}
		}

		buildDecorations(view: EditorView) {
			const builder = new RangeSetBuilder<Decoration>()

			// 仅遍历当前可见区域提高性能
			for (let { from, to } of view.visibleRanges) {
				syntaxTree(view.state).iterate({
					from,
					to,
					enter: (node) => {
						// 在源码模式下，行内代码的节点名称通常是 "inline-code"
						if (node.name === 'inline-code') {
							const text = view.state.doc.sliceString(node.from, node.to)
							// 正则匹配：`{lang}内容` (注意源码模式包含反引号)
							const match = text.match(/^`\{([\w\+]+)\}/)

							if (match) {
								const lang = match[1]
								builder.add(
									node.from,
									node.to,
									Decoration.mark({
										class: `cm-inline-code-${lang}`,
									})
								)
							}
						}
					},
				})
			}
			return builder.finish()
		}
	},
	{
		decorations: (v) => v.decorations,
	}
)
