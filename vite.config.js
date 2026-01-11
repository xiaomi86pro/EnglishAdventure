import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Base giữ nguyên của bạn
  base: '/EnglishAdventure/', 
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        // Chỉ định tất cả các file HTML bạn có
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html')
      }
    }
  }
})
