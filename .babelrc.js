const plugins = [
  ['@babel/plugin-transform-typescript', {
    isTSX: true
  }],
  ['@babel/plugin-transform-react-jsx', {
    pragma: 'h'
  }]
]

if (process.env.IN_EXAMPLES) {
  plugins.push([require('./dist/index.js'), {
    pragma : 'h',

    runtime: true,
    runtimeImport: 'runtime'
  }])
}

module.exports = {
  plugins: plugins
}
