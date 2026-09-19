import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, type Plugin } from "vite";

const lucideRuntime = readFileSync(
  fileURLToPath(new URL("./node_modules/lucide-react/dist/esm/lucide-react.mjs", import.meta.url)),
  "utf8",
);
const lucideDefaultExports = new Map<string, string>();
for (const [, specifiers, source] of lucideRuntime.matchAll(
  /export\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g,
)) {
  for (const specifier of specifiers.split(",")) {
    const alias = specifier.trim().match(/^default\s+as\s+([\w$]+)$/);
    if (alias && source.startsWith("./")) {
      lucideDefaultExports.set(alias[1], `lucide-react/dist/esm/${source.slice(2)}`);
    }
  }
}

function lucideDeepImports(): Plugin {
  return {
    name: "chenmeridian:lucide-deep-imports",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]src[\\/].*\.(?:ts|tsx)(?:\?.*)?$/.test(id)) return null;
      const lucideImport = /import\s+\{([^}]+)\}\s+from\s+["']lucide-react["'];?/g;
      return {
        code: code.replace(lucideImport, (match, namedSource: string) => {
          const statements: string[] = [];
          for (const rawName of namedSource.split(",")) {
            const specifier = rawName.trim();
            if (!specifier) continue;
            const isType = specifier.startsWith("type ");
            const [imported, local = imported] = specifier
              .replace(/^type\s+/, "")
              .split(/\s+as\s+/);
            if (isType || imported === "LucideIcon") {
              statements.push(`import type { ${imported} as ${local} } from "lucide-react";`);
              continue;
            }
            const source = lucideDefaultExports.get(imported);
            if (!source) throw new Error(`未找到 lucide-react 图标导出: ${imported}`);
            statements.push(`import ${local} from "${source}";`);
          }
          // Preserve the source line count so dev stack traces remain useful.
          return statements.join(";") + "\n".repeat(match.match(/\n/g)?.length ?? 0);
        }),
        map: null,
      };
    },
  };
}

export default defineConfig({
  plugins: [lucideDeepImports(), react(), tailwindcss()],
  optimizeDeps: {
    entries: ["index.html", "src/**/*.ts", "src/**/*.tsx"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    warmup: {
      clientFiles: ["src/**/*.ts", "src/**/*.tsx"],
    },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
});
