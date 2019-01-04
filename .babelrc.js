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
    pragma    : 'h',
    noRuntime : false,
    importName: 'window.runtime'
  }])
}

module.exports = {
  plugins: plugins
}
