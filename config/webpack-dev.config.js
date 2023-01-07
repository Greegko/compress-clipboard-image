const webpackConfig = require("./webpack.config.js");

module.exports = Object.assign(webpackConfig, {
  mode: "development",
  devtool: "cheap-module-source-map",

  stats: "minimal",

  devServer: {
    historyApiFallback: true,
  },
});
