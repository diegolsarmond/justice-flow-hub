import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
const normalizeBasePath = (value: string | undefined) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return "/";
  }

  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;

  if (withLeadingSlash.length === 1) {
    return withLeadingSlash;
  }

  return withLeadingSlash.replace(/\/+$/, "");
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");

  return {
    base: normalizeBasePath(env.VITE_APP_BASE_PATH),
    server: {
      host: "::",
      port: 8080,
    },
    define: {
      "import.meta.env.SERVER_URL_UAZAPI": JSON.stringify(env.SERVER_URL_UAZAPI),
    },
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    test: {
      environment: "jsdom",
      setupFiles: "./src/setupTests.ts",
      globals: true,
      css: true,
    },
  };
});
