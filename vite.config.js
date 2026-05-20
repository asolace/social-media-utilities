import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/anthropic": {
          target: "https://api.anthropic.com",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/anthropic/, ""),
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.removeHeader("origin");
              proxyReq.removeHeader("referer");
              // Inject the API key here, in the Node dev server — it never
              // reaches the browser. Mirrors api/anthropic/[...path].js in prod.
              if (env.ANTHROPIC_API_KEY) {
                proxyReq.setHeader("x-api-key", env.ANTHROPIC_API_KEY);
              }
            });
          },
        },
        "/api/yelp-img": {
          target: "https://s3-media0.fl.yelpcdn.com",
          changeOrigin: true,
          // Client sends the image path as ?path=… (matches the prod function);
          // turn it back into the real Yelp CDN path here.
          rewrite: (url) => {
            const query = url.split("?")[1] || "";
            const p = new URLSearchParams(query).get("path") || "";
            return "/" + p.replace(/^\/+/, "");
          },
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => {
              proxyReq.removeHeader("origin");
              proxyReq.removeHeader("referer");
            });
          },
        },
      },
    },
  };
});
