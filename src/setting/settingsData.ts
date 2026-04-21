// 默认的设置选项属性
export interface CyuTookitSettings {
	// 添加一个字符串索引签名，允许使用字符串来索引属性
	[key: string]: boolean | string
	setup_enable_hover_sider: boolean
	enable_clickCopy_block: boolean
	enable_auto_pin: boolean
	enable_parse_m3u8: boolean
	enable_color_gallery: boolean
	folder_color_gallery: string
	enable_icon_gallery: boolean
	folder_icon_gallery: string
}

export const DEFAULT_SETTINGS: CyuTookitSettings = {
	setup_enable_hover_sider: false,
	enable_clickCopy_block: true,
	enable_auto_pin: false,
	enable_parse_m3u8: true,
	enable_color_gallery: true,
	folder_color_gallery: '',
	enable_icon_gallery: true,
	folder_icon_gallery: '',
}

export const DEFAULT_SHAPES = {
	copy: '<svg t="1692805354681" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="2223" width="30" height="30"><path d="M704 202.666667a96 96 0 0 1 96 96v554.666666a96 96 0 0 1-96 96H213.333333A96 96 0 0 1 117.333333 853.333333V298.666667A96 96 0 0 1 213.333333 202.666667h490.666667z m0 64H213.333333A32 32 0 0 0 181.333333 298.666667v554.666666a32 32 0 0 0 32 32h490.666667a32 32 0 0 0 32-32V298.666667a32 32 0 0 0-32-32z" fill="#212121" p-id="2224"></path><path d="M277.333333 362.666667m32 0l298.666667 0q32 0 32 32l0 0q0 32-32 32l-298.666667 0q-32 0-32-32l0 0q0-32 32-32Z" fill="#212121" p-id="2225"></path><path d="M277.333333 512m32 0l298.666667 0q32 0 32 32l0 0q0 32-32 32l-298.666667 0q-32 0-32-32l0 0q0-32 32-32Z" fill="#212121" p-id="2226"></path><path d="M277.333333 661.333333m32 0l170.666667 0q32 0 32 32l0 0q0 32-32 32l-170.666667 0q-32 0-32-32l0 0q0-32 32-32Z" fill="#212121" p-id="2227"></path><path d="M320 138.666667h512A32 32 0 0 1 864 170.666667v576a32 32 0 0 0 64 0V170.666667A96 96 0 0 0 832 74.666667H320a32 32 0 0 0 0 64z" fill="#212121" p-id="2228"></path></svg>',
}
