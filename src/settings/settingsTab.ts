/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { App, Setting, PluginSettingTab, SettingTab } from 'obsidian'
import CyuToolkitPlugin from 'src/main'
import { FolderSuggest } from './suggesters/FolderSuggester'
import { FileSuggest, FileSuggestMode } from './suggesters/FileSuggester'

export class CyuToolkitSettingTab extends PluginSettingTab {
	plugin: CyuToolkitPlugin

	constructor(app: App, plugin: CyuToolkitPlugin) {
		super(app, plugin)
	}

	display(): void {
		const { containerEl } = this

		containerEl.empty()

		// Functions area
		containerEl.createEl('h2', { text: 'Functions' })
		this.addToggle('激活复制块', '是否启用复制块的点击复制功能', 'enable_clickCopy_block')
		this.addToggle('自动固定笔记', '在启动库时固定所有笔记页面', 'enable_auto_pin')
		this.addToggle('自动解析 m3u8 ', '将 .m3u8视 频解析为 .mp4 播放', 'enable_parse_m3u8')
		this.addToggle(
			'启用悬浮展开',
			'是否默认启用悬浮展开侧边栏功能',
			'setup_enable_hover_sider'
		)

		// Notes area
		containerEl.createEl('h2', { text: 'Notes' })

		this.addToggle(
			'颜色展廊',
			'用于创建一个可视化可交互的颜色展示廊笔记页面',
			'enable_color_gallery'
		)
		this.addFileSuggest(
			'颜色展廊的笔记路径',
			'在这里指定颜色展廊的笔记路径',
			'folder_color_gallery'
		)

		containerEl.createEl('hr')

		this.addToggle(
			'图标展廊',
			'用于创建一个可视化的图标展示廊笔记页面',
			'enable_icon_gallery'
		)
		this.addFileSuggest(
			'图标展廊的笔记路径',
			'在这里指定图标展廊的笔记路径',
			'folder_icon_gallery'
		)

		// this.addText(
		// 	'Auto pinned notes',
		// 	'pin all notes at startup',
		// 	'Example: 100',
		// 	'startupms (ms)'
		// )
	}

	addDropdown(name: string, desc: string): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addDropdown((dropdown) => dropdown.addOption('none', '').addOption('none2', ''))
	}

	addFileSuggest(
		name: string,
		desc: string,
		setting: string,
		placeholder = '示例：folder1/folder2/file1'
	) {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addSearch((fs) => {
				new FileSuggest(fs.inputEl, this.plugin, FileSuggestMode.TemplateFiles)
				fs.setPlaceholder(placeholder)
					.setValue(this.plugin.settings[setting] as string)
					.onChange((new_folder) => {
						this.plugin.settings[setting] = new_folder
						this.plugin.saveSettings()
					})
				// @ts-ignore
				fs.containerEl.addClass('templater_search')
			})
	}

	addFolderSuggest(
		name: string,
		desc: string,
		setting: string,
		placeholder = '示例：folder1/folder2'
	) {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addSearch((fs) => {
				new FolderSuggest(fs.inputEl)
				fs.setPlaceholder(placeholder)
					.setValue(this.plugin.settings[setting] as string)
					.onChange((new_folder) => {
						this.plugin.settings[setting] = new_folder
						this.plugin.saveSettings()
					})
				// @ts-ignore
				fs.containerEl.addClass('templater_search')
			})
	}

	addToggle(
		name: string,
		desc: string,
		setting: string,
		addtext?: string,
		callback?: (v: any) => any
	): void {
		const toggle = new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings[setting] as boolean)
					.onChange(async (value) => {
						this.plugin.settings[setting] = value
						this.plugin.saveSettings()
						if (callback) callback(value)
					})
			)

		if (addtext) {
			toggle.addText((text) => text.setPlaceholder(addtext))
		}
	}

	addText(
		name: string,
		desc: string,
		placeholder: string,
		setting: string,
		callback?: (v: any) => any
	): void {
		new Setting(this.containerEl)
			.setName(name)
			.setDesc(desc)
			.addText((text) =>
				text
					.setPlaceholder(placeholder)
					.setValue(this.plugin.settings[setting] as string)
					.onChange(async (value) => {
						this.plugin.settings[setting] = value
						this.plugin.saveSettings()
						if (callback) callback(value)
					})
			)
	}
}
