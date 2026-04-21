import React, { useEffect, useState, useRef } from 'react'
import { Notice } from 'obsidian'
import { getDominantColor } from '../utils/HandleColor'

interface ArtGalleryProps {
	imgSrc: string
	themeIndex?: number
	className?: string
	isOrderedList?: boolean
	// 允许传入外部引用的元素引用以便同步颜色
	h2Ref?: React.MutableRefObject<HTMLHeadingElement | null>
}

export const ArtGalleryComponent: React.FC<ArtGalleryProps> = ({
	imgSrc,
	themeIndex = 0,
	className = '',
	isOrderedList = false,
	h2Ref,
}) => {
	const [themeColor, setThemeColor] = useState<string>('')
	const [processedSrc, setProcessedSrc] = useState<string>(imgSrc)
	const imgRef = useRef<HTMLImageElement>(null)

	useEffect(() => {
		const handleColorExtraction = async () => {
			if (!imgSrc) return

			let currentSrc = imgSrc
			let blobUrl = ''

			// 处理跨域代理 (针对 imgbox)
			if (imgSrc.includes('imgbox.com')) {
				try {
					const proxyUrl = 'https://proxy.cors.sh/' + imgSrc
					const response = await fetch(proxyUrl, {
						headers: { 'x-cors-api-key': 'temp_0cbd61248d3a5eca7b7a554ec5b42eaf' },
					})
					if (!response.ok) throw new Error(`Proxy failed`)
					const blob = await response.blob()
					blobUrl = URL.createObjectURL(blob)
					setProcessedSrc(blobUrl)
					currentSrc = blobUrl
				} catch (error) {
					new Notice('代理请求失败: ' + error.message)
					return
				}
			}

			// 等待图片加载并提取颜色
			const img = new Image()
			img.crossOrigin = 'anonymous'
			img.src = currentSrc

			img.onload = () => {
				const colors = getDominantColor(img)
				if (colors && colors.length > 0) {
					const selectedColor = colors[themeIndex] || colors[0]
					setThemeColor(selectedColor)

					// 同步修改外部 H2 的颜色 (如果需要)
					if (h2Ref?.current) {
						h2Ref.current.style.setProperty('--h2-color', selectedColor)
					}
				}
				// 清理 Blob
				if (blobUrl) URL.revokeObjectURL(blobUrl)
			}
		}

		handleColorExtraction()
	}, [imgSrc, themeIndex])

	// 定义 CSS 变量对象
	const dynamicStyle = {
		'--cyu-theme-olor': themeColor,
		'--bold-color': themeColor,
		'--interactive-accent': themeColor,
		'--cyu-profile-border-color': themeColor,
		'--cyu-avatar-border-color': themeColor,
		'--cyu-list-marker-color': themeColor,
		'--cyu-cpb-bgcolor': themeColor,
		'--cyu-cpb-txcolor': '#FFFFFF',
	} as React.CSSProperties

	// 根据是否是 ol 渲染不同的容器
	const Tag = isOrderedList ? 'ol' : 'ul'

	return (
		<Tag
			className={`${isOrderedList ? 'el-ol' : 'el-ul'} ${className}`}
			style={dynamicStyle}
		>
			<li>
				<strong>
					<img ref={imgRef} src={processedSrc} alt="Gallery" />
				</strong>
			</li>
			{/* 这里可以根据需要添加 children 渲染列表内容 */}
		</Tag>
	)
}
