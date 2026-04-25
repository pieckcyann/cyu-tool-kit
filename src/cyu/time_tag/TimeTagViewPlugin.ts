import {
	Decoration,
	DecorationSet,
	EditorView,
	ViewPlugin,
	ViewUpdate,
	WidgetType,
} from '@codemirror/view'
import { RangeSet, RangeSetBuilder } from '@codemirror/state'

// 源码模式下的样式
// const timestampLineDeco = Decoration.line({
// 	attributes: { class: 'ctk-time-source-line' },
// })

// 源码模式下，正在编辑中的文本样式
const timestampEditingDeco = Decoration.mark({
	attributes: { class: 'ctk-time-editing-text' },
})

class TimeTagWidget extends WidgetType {
	constructor(readonly value: string) {
		super()
	}

	toDOM() {
		const span = document.createElement('span')
		span.className = 'ctk-time-source-line'
		span.textContent = this.value
		return span
	}
}

export const timeTagViewPlugin = ViewPlugin.fromClass(
	class {
		decorations: DecorationSet

		constructor(view: EditorView) {
			this.decorations = this.buildDecorations(view)
		}

		update(update: ViewUpdate) {
			// 关键：添加 update.selectionSet
			if (update.docChanged || update.viewportChanged || update.selectionSet) {
				this.decorations = this.buildDecorations(update.view)
			}
		}

		buildDecorations(view: EditorView): RangeSet<Decoration> {
			const builder = new RangeSetBuilder<Decoration>()
			// 1. 去掉 ^ 锚点，改用全局搜索 g
			// const regex = /@\{(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\}/g
			const regex = /@\{(\d{4}-\d{2}-\d{2}(?:\s\d{2}:\d{2}:\d{2})?)\}/g

			const currentSelections = view.state.selection.ranges

			for (const { from, to } of view.visibleRanges) {
				for (let pos = from; pos <= to; ) {
					const line = view.state.doc.lineAt(pos)
					const lineText = line.text

					// 2. 使用 matchAll 或 while(exec) 处理一行内的所有匹配
					let match
					regex.lastIndex = 0 // 重置正则索引

					while ((match = regex.exec(lineText)) !== null) {
						const timestamp = match[1]
						const startPos = line.from + match.index
						const endPos = startPos + match[0].length

						let isEditing = false
						for (const r of currentSelections) {
							// 判断光标是否与该语法区域重叠
							if (r.to >= startPos && r.from <= endPos) {
								isEditing = true
								break
							}
						}

						if (!isEditing) {
							builder.add(
								startPos,
								endPos,
								Decoration.replace({
									widget: new TimeTagWidget(timestamp),
								})
							)
						} else {
							// 如果正在编辑，我们不替换 Widget，而是给这部分文字加个高亮类名（可选）
							// 或者维持你原来的逻辑给整行加样式
							// builder.add(line.from, line.from, timestampLineDeco)

							// 关键改动：只给匹配到的 @{...} 这一段文本加样式
							builder.add(startPos, endPos, timestampEditingDeco)
						}
					}
					pos = line.to + 1
				}
			}
			return builder.finish()
		}
	},
	{
		decorations: (v) => v.decorations,
	}
)
