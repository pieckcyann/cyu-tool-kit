import { Plugin, HoverParent, HoverPopover } from 'obsidian'

export class ExternalImagePreview implements HoverParent {
	hoverPopover: HoverPopover | null = null
	private plugin: Plugin

	constructor(plugin: Plugin) {
		this.plugin = plugin
	}

	public init() {
		this.plugin.registerDomEvent(document, 'mouseover', this.handleMouseOver.bind(this))
	}

	private handleMouseOver(event: MouseEvent) {
		const target = event.target as HTMLElement

		// 1. 验证目标是否为外链
		if (!target || !target.classList.contains('external-link')) return

		const url = target.getAttribute('href')
		if (!url) return

		// 2. 匹配你的网络图片接口或后缀
		const isImageUrl =
			url.match(/\.(jpeg|jpg|gif|png|webp|svg)/i) || url.includes('urltoimage')
		if (!isImageUrl) return

		// 3. 必须依赖内置的 page-preview 来帮我们把 Popover 挂载到正确的图层上
		// @ts-ignore
		const pagePreviewPlugin = this.plugin.app.internalPlugins.plugins['page-preview']
		if (!pagePreviewPlugin || !pagePreviewPlugin.enabled) return

		const previewManager = pagePreviewPlugin.instance

		// 如果当前已经是这个元素的弹窗，直接返回
		if (this.hoverPopover && (this.hoverPopover as any).targetEl === target) return

		// 4. 让内置插件去实例化和挂载 Popover
		previewManager.onLinkHover(
			this, // HoverParent
			target, // 依托的 DOM 元素
			url, // 链接
			'' // 源路径
		)

		// 5. 关键核心：利用 MutationObserver（DOM 监听器）实时“截胡”
		// 只要检测到弹窗被创建，立刻清空原生内容，塞入我们的 <img>。这样能彻底阻止“文件未找到”的报错。
		this.watchAndInjectImage(url, target.innerText || '')
	}

	/**
	 * 实时监听并拦截内置弹窗的内容更新
	 */
	private watchAndInjectImage(url: string, linkText: string) {
		const customWidth = this.parseWidthFromText(linkText)

		const timer = setInterval(() => {
			if (!this.hoverPopover || !this.hoverPopover.hoverEl) return

			clearInterval(timer)

			const container = this.hoverPopover.hoverEl
			const popoverInstance = this.hoverPopover

			container.addClass('popover', 'hover-popover')
			container.style.padding = '0px'
			container.style.overflow = 'hidden'
			container.style.width = 'auto'
			container.style.height = 'auto'
			container.innerHTML = ''

			// 1. 创建加载中占位容器 (利用 Obsidian 原生的 Spinner 菊花转圈动画)
			const loadingEl = document.createElement('div')
			loadingEl.style.display = 'flex'
			loadingEl.style.flexDirection = 'column'
			loadingEl.style.alignItems = 'center'
			loadingEl.style.justifyContent = 'center'
			loadingEl.style.padding = '20px'
			loadingEl.style.gap = '8px'
			loadingEl.style.minWidth = '150px'
			loadingEl.style.minHeight = '80px'
			loadingEl.style.color = 'var(--text-muted)'
			loadingEl.style.fontSize = '13px'

			// 创建 Obsidian 原生转圈动画节点
			const spinnerEl = document.createElement('div')
			spinnerEl.addClass('spinner')
			// 微调内置 Spinner 样式使其居中好看
			spinnerEl.style.width = '24px'
			spinnerEl.style.height = '24px'

			const textEl = document.createElement('div')
			textEl.innerText = '正在加载图片...'

			loadingEl.appendChild(spinnerEl)
			loadingEl.appendChild(textEl)

			// 先把加载提示塞进弹窗中
			container.appendChild(loadingEl)

			// 2. 异步创建图片节点（隐藏状态，等加载完了再显示）
			const img = document.createElement('img')
			img.src = url
			img.style.display = 'none' // 初始隐藏
			img.style.objectFit = 'contain'
			img.style.margin = '0'

			if (customWidth) {
				img.style.width = `${customWidth}px`
				img.style.height = 'auto'
			} else {
				img.style.maxWidth = '450px'
				img.style.maxHeight = '450px'
			}

			// 3. 核心：当网络图片下载完毕后切换显示
			img.onload = () => {
				// 移除加载提示
				if (container.contains(loadingEl)) {
					container.removeChild(loadingEl)
				}
				// 显示图片并纠正 display
				img.style.display = 'block'

				// 如果图片还在 DOM 树里，通知 OB 重新量取高宽刷新弹窗尺寸
				if (
					container.contains(img) &&
					popoverInstance &&
					typeof (popoverInstance as any).onResize === 'function'
				) {
					;(popoverInstance as any).onResize()
				}
			}

			// 如果图片由于某些原因加载失败（如断网或 404），给予错误提示
			img.onerror = () => {
				spinnerEl.style.display = 'none'
				textEl.innerText = '⚠️ 图片加载失败'
				textEl.style.color = 'var(--text-error)'
			}

			// 把 img 塞入 container（此时它是隐藏的，onload 触发后才会露出来并顶掉 loadingEl）
			container.appendChild(img)

			// 4. 核心防御：防止原生报错文本覆盖我们的结构
			const observer = new MutationObserver(() => {
				if (
					container.innerText.includes('could not be found') ||
					container.querySelector('.markdown-embed')
				) {
					container.innerHTML = ''
					// 如果图片已经加载完了，直接放图片；否则放加载提示
					if (img.style.display === 'block') {
						container.appendChild(img)
					} else {
						container.appendChild(loadingEl)
						container.appendChild(img)
					}
				}
			})

			observer.observe(container, { childList: true, subtree: true })

			// 当弹窗关闭时，记得销毁监听器，释放内存
			// const originalClose = ((this.hoverPopover as any).close.bind(this.hoverPopover)(
			// 	this.hoverPopover as any
			// ).close = () => {
			// 	observer.disconnect()
			// 	originalClose()
			// })

			// 5. 【优雅销毁】不再劫持可能不存在的 close 方法
			// 直接监听 container 本身从 DOM 树中被移除的事件，安全释放 Observer
			const destroyObserver = () => {
				observer.disconnect()
				container.removeEventListener('DOMNodeRemovedFromDocument', destroyObserver)
			}
			container.addEventListener('DOMNodeRemovedFromDocument', destroyObserver)
		}, 10) // 每 10 毫秒检查一次，确保绝对的响应速度

		// 兜底保护：如果 1 秒内都没触发成功，防死锁
		setTimeout(() => clearInterval(timer), 1000)
	}

	private parseWidthFromText(text: string): string | null {
		if (!text.includes('|')) return null
		const parts = text.split('|')
		const lastPart = parts[parts.length - 1].trim()
		if (/^\d+$/.test(lastPart)) {
			return lastPart
		}
		return null
	}
}
