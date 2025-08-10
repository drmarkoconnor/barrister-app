// eleventy.config.js (ESM)
export default function (eleventyConfig) {
	// ✅ ensure /src/assets/** is copied to /assets/**
	eleventyConfig.addWatchTarget('src/assets/')
	eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' })

	return {
		dir: {
			input: 'src',
			includes: '_includes',
			layouts: '_includes/layouts',
			output: '_site',
		},
		templateFormats: ['njk', 'md', 'html'],
	}
}

