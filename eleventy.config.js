// eleventy.config.js (ESM)
export default function (eleventyConfig) {
	return {
		dir: {
			input: 'src', // our templates live in /src
			includes: '_includes', // /src/_includes
			layouts: '_includes/layouts',
			output: '_site',
		},
		// Optional but helpful:
		templateFormats: ['njk', 'md', 'html'],
	}
}

