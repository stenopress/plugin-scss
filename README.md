# @steno/plugin-scss

A Steno plugin that compiles Sass/SCSS entry files into a site's public
directory before the build copies it to staging. No separate build step, no
theme changes required.

## Usage

Put entry stylesheets under `content/styles/` (partials, `_foo.scss`, are
resolved via Sass's own `@use`/`@import` and are never compiled on their own):

```text
content/
├── styles/
│   ├── _colors.scss
│   └── site.scss   # @use "colors";
└── .steno/
    └── config.yml
```

```yaml
# content/.steno/config.yml
plugins:
  - jsr:@steno/plugin-scss@^0.1.0
```

`content/styles/site.scss` compiles to `/site.css` in the build output, so link
it like any other public asset:

```html
<link rel="stylesheet" href="/site.css" />
```

## Options

```yaml
plugins:
  - package: jsr:@steno/plugin-scss@^0.1.0
    options:
      srcDir: styles # relative to contentDir, default "styles"
      outDir: assets # relative to publicDir, default "" (public root)
      entries: [
        site.scss,
      ] # default: every top-level *.scss not starting with "_"
      style: expanded # "compressed" (default) or "expanded"
```

## Why a plugin, not a build-in feature

Steno's plugin hooks (`beforeBuild`, `transformAst`, `transformHtml`,
`afterPage`, `afterBuild`) don't include a generic asset-transform step - see
[Writing your own plugin](https://steno.gxbs.dev/docs/plugins). This plugin
instead runs during `beforeBuild`, before Steno collects the public directory's
files, and writes plain `.css` straight into it - so the rest of the build
pipeline (hashing, staging, atomic commit) treats the result as an ordinary
public file, no different from a hand-written stylesheet.

This only compiles a **site's own** stylesheets. A theme that wants to ship Sass
source (see `@steno/theme-aplos`) compiles it once at theme-load time in its own
`mod.ts` instead, since `StenoTheme.assets` only accepts plain CSS/JS/binary
content.

## Trust

This plugin only reads `srcDir` and writes `publicDir`, both under the site's
own `contentDir`. In `mode: isolated`, grant:

```yaml
plugins:
  - package: jsr:@steno/plugin-scss@^0.1.0
    mode: isolated
    permissions:
      read: [./content/styles]
      write: [./content/public]
```
