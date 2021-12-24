/**
 * Twig template engine
 *
 * Refrence :
 * - https://expressjs.com/en/advanced/developing-template-engines.html Developing template engine for Express
 * - https://nightlycommit.github.io/twing/api.html Twing for Developers
 */

const fs = require('fs');
const path = require('path');
const twing = require('twing');

class Twig {
	/**
	 * Constructs a new instance.
	 *
	 * @param      {mixed}  viewPaths  The view paths
	 * @param      {string}  cachePath  The cache path
	 */
	constructor(viewPaths, cachePath) {
		this.addTemplateLocation(viewPaths);
		this.loader = this.loader();
		this.twig = new twing.TwingEnvironment(this.loader, {
			debug: true,
			charset: 'utf-8',
			cache: false
		});
	}

	/**
	 * Twing loader
	 *
	 * @return     {twing}
	 */
	loader() {
		const loader = new twing.TwingLoaderFilesystem();
		this.template_directories.forEach((val, key) => {
			if (typeof val == 'object') {
				loader.addPath(val.path, val.name);
			} else {
				loader.addPath(val);
			}
		});

		return loader;
	}

	/**
	 * Add template location
	 *
	 * @param      {<type>}  viewPaths  The view paths
	 */
	addTemplateLocation(viewPaths) {
		this.template_directories = new Array();
		if (Array.isArray(viewPaths)) {
			viewPaths.forEach((val, key) => {
				this.template_directories.push(val);
			});
		} else {
			this.template_directories.push(viewPaths);
		}
	}

	/**
	 * Register the filter
	 */
	addFilter() {
		return this.twig.addFilter(new twing.TwingFilter(...arguments));
	}

	/**
	 * Register the function
	 */
	addFunction() {
		return this.twig.addFunction(new twing.TwingFunction(...arguments));
	}

	/**
	 * Render page
	 *
	 * @param      {string}    template  The template
	 * @param      {object}    options   The options
	 * @param      {Function}  callback  The callback
	 */
	render(template, options, callback) {
		this.twig.render(template, options).then((output) => {
			return callback(null, output);
		}, (error) => {
			return callback(error);
		});
	}
}

module.exports = Twig;
