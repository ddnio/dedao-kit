import { defineConfig } from 'vite';
import path from 'path';

// 先构建 content script（IIFE，完全内联）
export default defineConfig(({ mode }) => {
  if (mode === 'content') {
    return {
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        },
      },
      build: {
        outDir: 'dist',
        emptyOutDir: false, // 不清理，保留之前的构建
        rollupOptions: {
          input: path.resolve(__dirname, 'src/content/content-script.ts'),
          output: {
            entryFileNames: 'assets/content.js',
            format: 'iife',
            inlineDynamicImports: true
          }
        }
      }
    };
  }

  // 默认构建 popup（ES 模块）
  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          popup: path.resolve(__dirname, 'src/popup/popup.ts'),
        },
        output: {
          entryFileNames: 'assets/[name].js',
          format: 'es'
        }
      }
    }
  };
});
