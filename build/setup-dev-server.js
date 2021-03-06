/* eslint-disable no-console */
const path = require('path'),
	webpack = require('webpack'),
	MFS = require('memory-fs');

const clientConfig = require('./webpack/client'),
	serverConfig = require('./webpack/server');

module.exports = (app, opts) => {
	// modify client config to work with hot middleware
	clientConfig.entry = ['webpack-hot-middleware/client', clientConfig.entry];
	clientConfig.output.filename = '[name].js';
	if (!clientConfig.plugins) clientConfig.plugins = [];
	clientConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
	if (!clientConfig.optimization) clientConfig.optimization = {};
	clientConfig.optimization.noEmitOnErrors = true;

	// dev middleware
	const clientCompiler = webpack(clientConfig),
		serverCompiler = webpack(serverConfig),
		devMiddleware = require('webpack-dev-middleware')(clientCompiler, {
			publicPath: clientConfig.output.publicPath,
			stats: {
				colors: true,
				chunks: false
			}
		}),
		hotMiddleware = require('webpack-hot-middleware')(clientCompiler),
		mfs = new MFS(),
		layoutPath = path.join(clientConfig.output.path, 'index.html'),
		serverBundlePath = path.join(serverConfig.output.path, 'vue-ssr-server-bundle.json');

	app.use(devMiddleware);
	app.use(hotMiddleware);

	serverCompiler.outputFileSystem = mfs;

	clientCompiler.hooks.done.tap('done', () => {
		if (devMiddleware.fileSystem.existsSync(layoutPath))
			opts.layoutUpdated(devMiddleware.fileSystem.readFileSync(layoutPath, 'utf-8'));
	});

	serverCompiler.watch({}, (err, stats) => {
		if (err) throw err;
		stats = stats.toJson();
		stats.errors.forEach(err => console.error(err));
		stats.warnings.forEach(err => console.warn(err));
		opts.bundleUpdated(JSON.parse(mfs.readFileSync(serverBundlePath, 'utf-8')));
	});
};