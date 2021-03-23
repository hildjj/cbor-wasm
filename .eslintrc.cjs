module.exports = {
  root: true,
  extends: '@cto.af',
  parserOptions: {
    sourceType: 'module'
  },
  plugins: [
    'webassembly'
  ],
  rules: {
    'webassembly/no-unknown-export': 2,
    'node/no-unsupported-features/es-syntax': [
      'error',
      { ignores: ['modules'] }
    ]
  },
  globals: {
    WebAssembly: 'readonly'
  }
}
