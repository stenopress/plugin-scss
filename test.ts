import {
  assert,
  assertEquals,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import type { SiteConfig } from "@steno/steno";
import scssPlugin, { compileFromUrls } from "./mod.ts";

async function withTempDir(
  fn: (contentDir: string) => Promise<void>,
): Promise<void> {
  const contentDir = await Deno.makeTempDir({ prefix: "steno-scss-" });
  try {
    await fn(contentDir);
  } finally {
    await Deno.remove(contentDir, { recursive: true });
  }
}

function siteConfig(
  contentDir: string,
  publicDir: string | false,
): SiteConfig {
  return {
    title: "Test site",
    description: "A site used by plugin tests",
    author: "Test author",
    contentDir,
    publicDir,
  };
}

Deno.test({
  name: "scss: compiles entries and excludes partials",
  fn: async () => {
    await withTempDir(async (contentDir) => {
      await Deno.mkdir(`${contentDir}/styles`);
      await Deno.writeTextFile(
        `${contentDir}/styles/_colors.scss`,
        "$color: red;",
      );
      await Deno.writeTextFile(
        `${contentDir}/styles/site.scss`,
        '@use "colors";\nmain { color: colors.$color; }',
      );

      const plugin = scssPlugin();
      await plugin.beforeBuild!(siteConfig(contentDir, "public"));

      assertEquals(
        await Deno.readTextFile(`${contentDir}/public/site.css`),
        "main{color:red}",
      );
      await assertRejects(
        () => Deno.stat(`${contentDir}/public/_colors.css`),
        Deno.errors.NotFound,
      );
    });
  },
});

Deno.test({
  name: "scss: uses custom source, output, entries, and style options",
  fn: async () => {
    await withTempDir(async (contentDir) => {
      await Deno.mkdir(`${contentDir}/sass/pages`, { recursive: true });
      await Deno.writeTextFile(
        `${contentDir}/sass/pages/home.scss`,
        ".home { color: blue; }",
      );

      const plugin = scssPlugin({
        srcDir: "sass",
        outDir: "assets/css",
        entries: ["pages/home.scss"],
        style: "expanded",
      });
      await plugin.beforeBuild!(siteConfig(contentDir, "static"));

      const css = await Deno.readTextFile(
        `${contentDir}/static/assets/css/pages/home.css`,
      );
      assert(css.includes(".home {"));
      assert(css.includes("color: blue;"));
    });
  },
});

Deno.test({
  name: "scss: does nothing without a source directory",
  fn: async () => {
    await withTempDir(async (contentDir) => {
      const plugin = scssPlugin();
      await plugin.beforeBuild!(siteConfig(contentDir, "public"));

      await assertRejects(
        () => Deno.stat(`${contentDir}/public`),
        Deno.errors.NotFound,
      );
    });
  },
});

Deno.test({
  name: "scss: rejects sites without a public directory",
  fn: async () => {
    const plugin = scssPlugin();

    await assertRejects(
      async () => await plugin.beforeBuild!(siteConfig("content", false)),
      Error,
      "requires a public directory",
    );
  },
});

Deno.test({
  name: "scss: surfaces a compile error for invalid Sass syntax",
  fn: async () => {
    await withTempDir(async (contentDir) => {
      await Deno.mkdir(`${contentDir}/styles`);
      await Deno.writeTextFile(
        `${contentDir}/styles/site.scss`,
        "main { color: ",
      );

      const plugin = scssPlugin();

      await assertRejects(
        async () => await plugin.beforeBuild!(siteConfig(contentDir, "public")),
      );
    });
  },
});

Deno.test({
  name: "scss: surfaces an error for an unresolved @use",
  fn: async () => {
    await withTempDir(async (contentDir) => {
      await Deno.mkdir(`${contentDir}/styles`);
      await Deno.writeTextFile(
        `${contentDir}/styles/site.scss`,
        '@use "missing";\nmain { color: missing.$color; }',
      );

      const plugin = scssPlugin();

      await assertRejects(
        async () => await plugin.beforeBuild!(siteConfig(contentDir, "public")),
      );
    });
  },
});

Deno.test({
  name: "scss: treats a srcDir that is a file as no source directory",
  fn: async () => {
    await withTempDir(async (contentDir) => {
      await Deno.writeTextFile(`${contentDir}/styles`, "not a directory");

      const plugin = scssPlugin();
      await plugin.beforeBuild!(siteConfig(contentDir, "public"));

      await assertRejects(
        () => Deno.stat(`${contentDir}/public`),
        Deno.errors.NotFound,
      );
    });
  },
});

Deno.test({
  name: "scss: compiles nested entries preserving directory structure",
  fn: async () => {
    await withTempDir(async (contentDir) => {
      await Deno.mkdir(`${contentDir}/styles/pages`, { recursive: true });
      await Deno.writeTextFile(
        `${contentDir}/styles/pages/home.scss`,
        ".home { color: blue; }",
      );

      const plugin = scssPlugin({ entries: ["pages/home.scss"] });
      await plugin.beforeBuild!(siteConfig(contentDir, "public"));

      assertEquals(
        await Deno.readTextFile(`${contentDir}/public/pages/home.css`),
        ".home{color:blue}",
      );
    });
  },
});

Deno.test({
  name:
    "compileFromUrls: concatenates and compiles Sass sources from file URLs",
  fn: async () => {
    await withTempDir(async (dir) => {
      await Deno.writeTextFile(`${dir}/_colors.scss`, "$color: red;");
      await Deno.writeTextFile(
        `${dir}/base.scss`,
        "main { color: $color; }",
      );

      const css = await compileFromUrls(`file://${dir}/`, [
        "./_colors.scss",
        "./base.scss",
      ]);

      assertEquals(css, "main{color:red}");
    });
  },
});

Deno.test({
  name: "compileFromUrls: honors the expanded style option",
  fn: async () => {
    await withTempDir(async (dir) => {
      await Deno.writeTextFile(`${dir}/base.scss`, "main { color: blue; }");

      const css = await compileFromUrls(`file://${dir}/`, ["./base.scss"], {
        style: "expanded",
      });

      assertStringIncludes(css, "main {");
      assertStringIncludes(css, "color: blue;");
    });
  },
});

Deno.test({
  name: "compileFromUrls: rejects when a source file is missing",
  fn: async () => {
    await withTempDir(async (dir) => {
      await assertRejects(
        () => compileFromUrls(`file://${dir}/`, ["./missing.scss"]),
      );
    });
  },
});
