import { Command, Editor, MarkdownFileInfo, MarkdownView } from 'obsidian'

const createAnAnnotation = (direction: 'left' | 'right') => {
	return (editor: Editor, ctx: MarkdownView | MarkdownFileInfo) => {
		const cursor = editor.getCursor()
		const lineCount = editor.lineCount()
		let targetLine = cursor.line

		// 1. 寻找第一个空行
		let foundEmptyLine = false
		for (let i = targetLine; i < lineCount; i++) {
			if (editor.getLine(i).trim() === '') {
				targetLine = i
				foundEmptyLine = true
				break
			}
		}

		// 2. 准备插入内容
		const selection = editor.getSelection()
		const contentToInsert = `\n\`\`\`annotationr\n${direction} "${selection}" xxx\n\`\`\``

		if (foundEmptyLine) {
			// 如果找到了空行，直接在该行插入
			editor.replaceRange(contentToInsert, { line: targetLine, ch: 0 })

			const cursorLine = targetLine - 1
			const cursorLineContent = editor.getLine(cursorLine) // 获取这行的内容

			// 3. 移动光标：移动到该行内容的末尾
			editor.setCursor({
				line: cursorLine,
				ch: cursorLineContent.length,
			})
		} else {
			// 如果没找到空行，在文档末尾另起一行插入
			const lastLine = lineCount
			const finalContent = `\n${contentToInsert}`
			editor.replaceRange(finalContent, { line: lastLine, ch: 0 })

			// 3. 移动光标：移动到新生成的最后一行
			editor.setCursor({
				line: lastLine,
				ch: contentToInsert.length,
			})
		}

		// 视口跟着跳过去
		editor.scrollIntoView(
			{
				from: { line: targetLine, ch: 0 },
				to: { line: targetLine, ch: 0 },
			},
			true
		)

		// 4. 聚焦编辑器（确保光标闪烁）
		editor.focus()
	}
}

export const createRightAnnotation = createAnAnnotation('right')

export const createLeftAnnotation = createAnAnnotation('left')
