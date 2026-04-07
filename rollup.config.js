import { readFileSync } from 'node:fs';

import resolve from '@rollup/plugin-node-resolve';
import copy from 'rollup-plugin-copy';
import css from 'rollup-plugin-import-css';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));

const external = [
  ...Object.keys(pkg.peerDependencies || {}),
  /^bpmn-js\//,
  /^diagram-js\//,
];

export default {
  input: 'lib/index.js',
  external,
  output: {
    file: 'dist/bpmn-js-touch-interaction.esm.js',
    format: 'esm',
    sourcemap: true,
  },
  plugins: [
    resolve(),

    // Inline CSS imports as runtime-injected <style> tags so consumers get
    // the plugin's styles automatically on import (matches the "No host CSS"
    // story in the README).
    css({ inject: true, minify: true }),

    // Also copy the raw stylesheet so `bpmn-js-touch-interaction/style.css`
    // subpath import still works for consumers who prefer explicit CSS.
    copy({
      targets: [
        { src: 'lib/styles/touch-interaction.css', dest: 'dist/assets' },
      ],
    }),
  ],
};
