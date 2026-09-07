import { build } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });

await build({
  entryPoints: ["src/background.ts", "src/content.ts", "src/sidepanel.ts"],
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "chrome120",
});

copyFileSync("manifest.json", "dist/manifest.json");
copyFileSync("src/sidepanel.html", "dist/sidepanel.html");
copyFileSync("src/sidepanel.css", "dist/sidepanel.css");
