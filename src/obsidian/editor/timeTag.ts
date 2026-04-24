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
const timestampLineDeco = Decoration.line({
	attributes: { class: 'ctk-time-source-line' },
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
			const regex = /^@\{(\d{4}-\d{2}-\d{2}.*?)\}/
			const currentSelections = view.state.selection.ranges

			for (const { from, to } of view.visibleRanges) {
				for (let pos = from; pos <= to; ) {
					const line = view.state.doc.lineAt(pos)
					const match = line.text.match(regex)

					if (match) {
						const timestamp = match[1]
						const startPos = line.from + (match.index ?? 0)
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
							// 正在编辑时，给整行加样式（变小/变灰）
							builder.add(line.from, line.from, timestampLineDeco)
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
