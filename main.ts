import { MarkdownView, Notice, Plugin } from 'obsidian';

export default class MyPlugin extends Plugin {

	async onload() {
		this.registerMarkdownPostProcessor(this.processMarkdown.bind(this));
	}

	processMarkdown(el: HTMLElement, ctx: MarkdownView) {
		// 查找包含特定类名的元素
		const elements = el.querySelectorAll('.ic');
		elements.forEach((element) => {
			element.addEventListener('click', () => {
				if (element.textContent) {
					// this.copyToClipboard(element.textContent);
					this.copyToClipboard(element.innerHTML);
					new Notice('已复制！');
				}
			});
		});
	}

	copyToClipboard(text: string) {
		const textArea = document.createElement('textarea');
		textArea.value = text;
		document.body.appendChild(textArea);
		textArea.select();
		document.execCommand('copy');
		document.body.removeChild(textArea);
	}

	onunload() {

	}
}
