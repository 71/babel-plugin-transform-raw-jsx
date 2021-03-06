module.exports = {
  mode: 'production',
  entry: {
    'dist/index'   : './src/index.ts',
    'runtime/index': './src/runtime/index.ts',
    'runtime/async': './src/runtime/async.ts',
    'runtime/map'  : './src/runtime/map.ts'
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ]
  },
  output: {
    path: __dirname,
    filename: '[name].js',
    libraryTarget: 'umd',
    library: 'babel-plugin-transform-raw-jsx',
    umdNamedDefine: true,
    globalObject: 'this'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'awesome-typescript-loader',
        exclude: /node_modules/
      }
    ]
  },
  devtool: 'source-map'
}
