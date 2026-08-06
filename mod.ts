/**
 * This module exports a Steno plugin that compiles Sass/SCSS entry files
 * into a site's public directory before the build copies it to staging.
 *
 * @module
 */

import type { SiteConfig, StenoPlugin } from "@steno/steno";
import { dirname, join, relative } from "@std/path";
import * as sass from "sass";

/** Options for {@linkcode default | createScssPlugin}. */
export interface ScssPluginOptions {
  /**
   * Directory to look for Sass entry files, relative to `contentDir`.
   * Defaults to `"styles"`. Partials (files starting with `_`) are never
   * compiled directly, but are resolved when an entry `@use`s or `@import`s
   * them from this same directory.
   */
  srcDir?: string;
  /**
   * Directory under the site's `publicDir` to write compiled CSS into.
   * Defaults to `""` (the public directory root). The relative path of each
   * entry (under `srcDir`) is preserved beneath it.
   */
  outDir?: string;
  /**
   * Explicit list of entry files to compile, relative to `srcDir`. Defaults
   * to every top-level `*.scss`/`*.sass` file in `srcDir` not starting with
   * `_`.
   */
  entries?: string[];
  /** Sass output style. Defaults to `"compressed"`. */
  style?: "compressed" | "expanded";
}

async function discoverEntries(srcDirPath: string): Promise<string[]> {
  const entries: string[] = [];
  for await (const entry of Deno.readDir(srcDirPath)) {
    if (!entry.isFile) continue;
    if (entry.name.startsWith("_")) continue;
    if (!/\.s[ac]ss$/i.test(entry.name)) continue;
    entries.push(entry.name);
  }
  return entries;
}

/**
 * Compiles Sass/SCSS entry files under `srcDir` (relative to `contentDir`,
 * `content/styles` by default) into the site's public directory as plain
 * CSS, before Steno copies public files to the build's staging directory.
 * Partials (`_foo.scss`) are resolved via Sass's own `@use`/`@import`
 * resolution and are never compiled on their own.
 *
 * ```yaml
 * plugins:
 *   - jsr:@steno/plugin-scss
 * ```
 *
 * A site's `content/styles/site.scss` compiles to `/site.css` in the
 * output, ready to be linked from a layout or page:
 *
 * ```html
 * <link rel="stylesheet" href="/site.css" />
 * ```
 */
export default function createScssPlugin(
  options: ScssPluginOptions = {},
): StenoPlugin {
  return {
    name: "scss",
    async beforeBuild(config: SiteConfig) {
      if (config.publicDir === false) {
        throw new Error(
          "@steno/plugin-scss requires a public directory, but this site " +
            "has `publicDir: false`.",
        );
      }

      const contentDir = config.contentDir || "content";
      const srcDirPath = join(contentDir, options.srcDir ?? "styles");
      const publicDirPath = join(
        contentDir,
        config.publicDir || "public",
      );

      try {
        const stat = await Deno.stat(srcDirPath);
        if (!stat.isDirectory) return;
      } catch {
        // No Sass source directory: nothing to compile, quietly no-op.
        return;
      }

      const entries = options.entries ?? await discoverEntries(srcDirPath);

      for (const entry of entries) {
        const entryPath = join(srcDirPath, entry);
        const result = sass.compile(entryPath, {
          style: options.style ?? "compressed",
          loadPaths: [srcDirPath],
        });

        const relPath = relative(srcDirPath, entryPath).replace(
          /\.s[ac]ss$/i,
          ".css",
        );
        const destPath = join(publicDirPath, options.outDir ?? "", relPath);
        await Deno.mkdir(dirname(destPath), { recursive: true });
        await Deno.writeTextFile(destPath, result.css);
      }
    },
  };
}
