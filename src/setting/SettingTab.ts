import { App, Setting, PluginSettingTab, SearchComponent } from 'obsidian'
import CyuToolkitPlugin from '../main'
import { FolderSuggest } from './suggesters/FolderSuggester'
import { FileSuggest, FileSuggestMode } from './suggesters/FileSuggester'
import { ANNOTATION_STYLES } from './SettingData'

type Settings = CyuToolkitPlugin['settings']

export class CyuToolkitPluginSettingTab extends PluginSettingTab {
	plugin: CyuToolkitPlugin
	private saveTimer: number | null = null

	constructor(app: App, plugin: CyuToolkitPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		this.renderFunctions()
		this.renderAnnotation()
		this.renderNotes()
	}

	private renderFunctions() {
		this.containerEl.createEl('h2', { text: 'Functions' })

		this.addToggle('激活复制块', '是否启用复制块的点击复制功能', 'enable_clickCopy_block')
		this.addToggle('自动固定笔记', '在启动库时固定所有笔记页面', 'enable_auto_pin')
		this.addToggle('自动解析 m3u8 ', '将 .m3u8视频解析为 .mp4 播放', 'enable_parse_m3u8')
		this.addToggle(
			'启用悬浮展开',
			'是否默认启用悬浮展开侧边栏功能',
			'setup_enable_hover_sider'
		)
	}

	private renderAnnotation() {
		this.containerEl.createEl('h2', { text: 'Annotation 侧边注释' })

		const current =
			ANNOTATION_STYLES.find((s) => s.value === this.plugin.settings.annotation_style)
				?.desc ?? ''

		const desc = `选择侧边注释的外观样式，可随时切换并实时生效。当前：${current}`

		this.createSetting('注释样式', desc).addDropdown((dd) => {
			ANNOTATION_STYLES.forEach((s) => dd.addOption(s.value, s.label))
			dd.setValue(this.plugin.settings.annotation_style).onChange((v) => {
				this.updateSetting('annotation_style', v as Settings['annotation_style'])
				this.plugin.applyAnnotationStyle()
				// 重新渲染设置面板，更新描述里的“当前”样式说明
				this.display()
			})
		})
	}

	private renderNotes() {
		this.containerEl.createEl('h2', { text: 'Notes' })

		this.addToggle(
			'颜色展廊',
			'用于创建一个可视化可交互的颜色展示廊笔记页面',
			'enable_color_gallery'
		)
		this.addPathSuggest(
			'颜色展廊的笔记路径',
			'在这里指定颜色展廊的笔记路径',
			'folder_color_gallery',
			'file',
			'示例：folder1/folder2/file1'
		)

		this.containerEl.createEl('hr')

		this.addToggle(
			'图标展廊',
			'用于创建一个可视化的图标展示廊笔记页面',
			'enable_icon_gallery'
		)
		this.addPathSuggest(
			'图标展廊的笔记路径',
			'在这里指定图标展廊的笔记路径',
			'folder_icon_gallery',
			'file',
			'示例：folder1/folder2/file1'
		)

		this.containerEl.createEl('hr')

		this.addToggle(
			'字体展廊',
			'用于创建一个可视化的字体展示廊笔记页面',
			'enable_icon_gallery'
		)
		this.addPathSuggest(
			'字体展廊的笔记路径',
			'在这里指定字体展廊的笔记路径',
			'folder_font_gallery',
			'file',
			'示例：folder1/folder2/file1'
		)
	}

	// ---------- core helpers ----------

	private updateSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
		this.plugin.settings[key] = value

		if (this.saveTimer) window.clearTimeout(this.saveTimer)
		this.saveTimer = window.setTimeout(() => {
			this.plugin.saveSettings()
		}, 300)
	}

	private createSetting(name: string, desc: string) {
		return new Setting(this.containerEl).setName(name).setDesc(desc)
	}

	// ---------- controls ----------

	addToggle<K extends keyof Settings>(
		name: string,
		desc: string,
		setting: K,
		callback?: (v: boolean) => void
	) {
		this.createSetting(name, desc).addToggle((t) =>
			t.setValue(this.plugin.settings[setting] as boolean).onChange((v) => {
				this.updateSetting(setting, v as Settings[K])
				callback?.(v)
			})
		)
	}

	addText<K extends keyof Settings>(
		name: string,
		desc: string,
		placeholder: string,
		setting: K,
		callback?: (v: string) => void
	) {
		this.createSetting(name, desc).addText((t) =>
			t
				.setPlaceholder(placeholder)
				.setValue(this.plugin.settings[setting] as string)
				.onChange((v) => {
					this.updateSetting(setting, v as Settings[K])
					callback?.(v)
				})
		)
	}

	private addPathSuggest<K extends keyof Settings>(
		name: string,
		desc: string,
		setting: K,
		type: 'file' | 'folder',
		placeholder: string
	) {
		this.createSetting(name, desc).addSearch((fs: SearchComponent) => {
			if (type === 'file') {
				new FileSuggest(fs.inputEl, this.plugin, FileSuggestMode.TemplateFiles)
			} else {
				new FolderSuggest(fs.inputEl)
			}

			fs.setPlaceholder(placeholder)
				.setValue(this.plugin.settings[setting] as string)
				.onChange((v) => this.updateSetting(setting, v as Settings[K]))
			// @ts-ignore
			;(fs.containerEl as HTMLElement).classList.add('templater_search')
		})
	}
}
export { PluginSettingTab }
