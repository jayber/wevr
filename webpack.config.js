const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'wevr.js',
    path: path.resolve(__dirname, 'dist'),
    library: "wevr",
    libraryTarget: "umd"
  },
  module: {
    rules: [
      { test: /src\/\w*\.js$/, use: {
        loader: 'babel-loader',
        options: {
          presets: ['env']
        }
      } }
    ]
  },
  devServer: {
    publicPath: "/dist/"
  }
};