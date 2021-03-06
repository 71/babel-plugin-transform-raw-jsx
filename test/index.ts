import * as babel from '@babel/core'
import plugin     from '../src'

import { readFileSync } from 'fs'


const options = {
  presets: [
    '@babel/preset-env'
  ],

  plugins: [
    ['@babel/plugin-transform-typescript', {
      isTSX: true
    }],
    ['@babel/plugin-transform-react-jsx', {
      pragma: 'h'
    }],
    [plugin, {
      pragma : 'h',

      runtime: true,
      runtimeImport: 'runtime'
    }]
  ]
}

it('works', () => {
  const source = readFileSync(__dirname + '/../examples/numbers/index.tsx', 'utf8')
  const { code } = babel.transformSync(source, options)

  console.log(code)
})
