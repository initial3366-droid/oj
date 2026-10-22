/**
 * Vite 构建与开发服务器配置。
 * 开发环境将 HTTP 与 WebSocket 请求代理到同一个后端来源，避免浏览器跨域差异。
 */
import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import AutoImport from "unplugin-auto-import/vite";
import Components from "unplugin-vue-components/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import UnoCSS from "unocss/vite";
import { resolve } from "node:path";

declare const process: {
  cwd: () => string;
  env: Record<string, string | undefined>;
};

export default defineConfig(({ mode }) => {
  // loadEnv 的第三个参数为空字符串，表示同时读取带前缀和不带前缀的本地构建变量。
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    process.env.VITE_API_PROXY_TARGET ?? env.VITE_API_PROXY_TARGET ?? "http://127.0.0.1:18080";
  // 保留主机、端口和路径，仅把 http(s) 协议映射为 ws(s) 供 Vite WebSocket 代理使用。
  const wsProxyTarget = apiProxyTarget.replace(/^http/, "ws");
  const agentProxyTarget = process.env.VITE_AGENT_PROXY_TARGET ?? env.VITE_AGENT_PROXY_TARGET ?? "http://127.0.0.1:19090";

  return {
    plugins: [vue(), UnoCSS(), AutoImport({ imports: ["vue", "@vueuse/core", "pinia", "vue-router", "vue-i18n", { "element-plus": ["ElMessage", "ElMessageBox", "ElNotification", "ElLoading"] }], dts: "src/vue/template-adapter/auto-imports.d.ts" }), Components({ dirs: ["vendor/vue3-element-admin/src/components", "vendor/vue3-element-admin/src/layouts/components"], resolvers: [ElementPlusResolver({ importStyle: false })], dts: false })],
    resolve: { alias: [
      { find: "@/stores/tenant", replacement: resolve("src/vue/template-adapter/tenant.ts") },
      { find: "@/stores/user", replacement: resolve("src/vue/template-adapter/stores.ts") },
      { find: "@/stores/permission", replacement: resolve("src/vue/template-adapter/stores.ts") },
      { find: /^@\/stores$/, replacement: resolve("src/vue/template-adapter/stores.ts") },
      { find: /^@\/router$/, replacement: resolve("src/vue/template-adapter/router.ts") },
      { find: "@/utils/sse", replacement: resolve("src/vue/template-adapter/sse.ts") },
      { find: "@/api/auth", replacement: resolve("src/vue/template-adapter/auth.ts") },
      { find: "@/api/system/notice", replacement: resolve("src/vue/template-adapter/notice.ts") },
      { find: "@", replacement: resolve("vendor/vue3-element-admin/src") },
    ] },
    css: { preprocessorOptions: { scss: { additionalData: '@use "@/styles/variables.scss" as *;' } } },
    define: {
      global: "globalThis",
      __APP_INFO__: JSON.stringify({ pkg: { name: "QOJ", version: "0.1.0" }, buildTimestamp: Date.now() }),
    },
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: "globalThis",
        },
      },
    },
    build: {
      // Keep route component CSS lazy with its JavaScript chunk.
      cssCodeSplit: true,
      assetsInlineLimit: Infinity,
      modulePreload: false,
      rollupOptions: {
        output: {
          entryFileNames: "assets/app-[hash].js",
          assetFileNames: "assets/app-[hash][extname]",
        },
      },
      // Monaco 编辑器等大型依赖属于预期体积，避免构建时反复输出误导性的 500KB 警告。
      chunkSizeWarningLimit: 5000,
    },
    server: {
      proxy: {
        "/api": apiProxyTarget,
        "/agent": { target: agentProxyTarget, rewrite: (path) => path.replace(/^\/agent/, "") },
        "/ws": {
          target: wsProxyTarget,
          ws: true,
        },
      },
    },
  };
});
