import { defineConfig } from 'eslint/config'

import bpmnIoPlugin from 'eslint-plugin-bpmn-io'

export default defineConfig([
  {
    ignores: ['node_modules/**', 'coverage/**', 'dist/**'],
  },
  ...bpmnIoPlugin.configs.browser.map(config => ({
    ...config,
    files: ['lib/**/*.js'],
  })),
  ...bpmnIoPlugin.configs.mocha.map(config => ({
    ...config,
    files: ['test/**/*.js'],
  })),
])
