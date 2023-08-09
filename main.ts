// 导入所需的 Obsidian 模块
import { App, Notice, Editor, MarkdownView, Plugin, PluginSettingTab, Setting } from 'obsidian'

// 默认的设置选项属性
interface MyPluginSettings {
    enablecpblock: boolean,
}

const DEFAULT_SETTINGS: MyPluginSettings = {
    enablecpblock: false,
}

export default class MyPlugin extends Plugin {
    settings: MyPluginSettings;

    async onload() {
        // await this.loadSettings();
        this.addSettingTab(new SampleSettingTab(this.app, this))

        // 注册一个 Markdown 后处理器，用于处理 Markdown 渲染后的 HTML 元素
        this.registerMarkdownPostProcessor(this.processCpblock.bind(this))
    }

    // 处理字符串
    processCpblock(el: HTMLElement) {
        const enablecpblock = this.settings.enablecpblock;
        if (enablecpblock) {
            // ! 获取所有不在 <pre> 元素内的 <p> 和 <li> 元素
            const nodes = el.querySelectorAll(':not(pre) > p, :not(pre) > li');

            Array.from(nodes).forEach(node => {
                //创建了一个 DOM 树遍历器，用于遍历指定节点的子树，并仅显示文本节点。
                const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, null);
                let textNode;

                // 遍历文本节点
                while ((textNode = walker.nextNode())) {
                    const text = textNode.nodeValue || '';

                    // ! 使用正则表达式将双破折号括起的文本替换为 <span class="ic">...</span>
                    const replacedText = text.replace(/--(.*?)--/g, '<span class="ic">$1</span>');

                    // 如果有文本被替换，则进行进一步处理
                    if (replacedText !== text) {
                        // 创建临时 div 以容纳新的元素
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = replacedText;

                        // 遍历临时 div 内的元素
                        while (tempDiv.firstChild) {
                            // ? 将 tempDiv 元素的第一个子节点断言为 HTMLElement 类型，并将其赋值给 spanElement 变量
                            const spanElement = tempDiv.firstChild as HTMLElement;

                            // 添加点击事件，点击后复制文本并显示通知框
                            spanElement.addEventListener('click', () => {
                                this.copyTextToClipboard(spanElement.innerText);
                                new Notice('Text copied: ' + spanElement.innerText);
                            });

                            // 插入新元素到原节点中
                            node.insertBefore(spanElement, textNode);
                        }

                        // 移除原始文本节点
                        node.removeChild(textNode);
                    }
                }
            });
        }

        // 注册命令
        this.addCommand({
            id: 'cpblock-syntax-surround',
            name: 'cpblock syntax surround',
            editorCallback: (editor: Editor, view: MarkdownView) => {
                const selectedText = editor.getSelection();

                if (selectedText) {
                    const surroundedText = `--${selectedText}--`;
                    editor.replaceSelection(surroundedText);
                }
            }
        });
    }

    // 复制文本到剪贴板
    copyTextToClipboard(text: string) {
        const textArea = document.createElement('textarea')
        textArea.value = text
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
    }

    async saveSettings() {
        await this.saveData(this.settings)
    }
}



class SampleSettingTab extends PluginSettingTab {
    plugin: MyPlugin;
    constructor(app: App, plugin: MyPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl("h2", { text: "工具启停" });

        new Setting(containerEl)
            .setName('Copy click block')
            .setDesc('Create a click-copy code block')
            .addToggle(text =>
                text
                    .setValue(this.plugin.settings.enablecpblock)
                    .onChange(async value => {
                        this.plugin.settings.enablecpblock = value;
                        await this.plugin.saveSettings();
                    })
            );

        // new Setting(containerEl)
        //     .setName("允许选中文字后在两边插入符号")
        //     .addToggle(text =>
        //         text
        //             .setValue(this.plugin.settings.allowSelectEmbed)
        //             .onChange(async value => {
        //                 this.plugin.settings.allowSelectEmbed = value;
        //                 await this.plugin.saveSettings();
        //             })
        //     );
    }
}