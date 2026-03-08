import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carrega todas as variáveis de ambiente, inclusive as que não começam com VITE_
  const env = loadEnv(mode, process.cwd(), "");

  const proxyTarget =
    env.VITE_BACKEND_PROXY ||
    env.API_PROXY_TARGET ||
    env.BACKEND_URL ||
    "http://localhost:3001";

  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    define: {
      "import.meta.env.SERVER_URL_UAZAPI": JSON.stringify(env.SERVER_URL_UAZAPI),
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    // root removed - using project root with frontend/src via alias
    build: {
      outDir: path.resolve(__dirname, "dist"),
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "frontend/src"),
      },
    },
  };
});