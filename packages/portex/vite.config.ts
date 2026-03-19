import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Portex',
      formats: ['es', 'cjs'],
      fileName: 'portex',
    },
  },
  plugins: [dts({ rollupTypes: true })],
  test: {
    globals: true,
  },
});
