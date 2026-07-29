# Terminal Theme

A portable, framework-agnostic CSS theme: Tokyonight palette, JetBrains Mono,
flat "terminal/TUI" aesthetic — no shadows, no rounded corners, no motion. State
is signalled with color only.

Plain CSS. No build step, no SvelteKit/React coupling. Copy the folder, add two
imports.

Open **`example.html`** in a browser to preview every token, base HTML element,
and component class — a living style guide and portability smoke test.

## Vendor it

Copy this `theme/` folder into your app, then import **reset first, theme
second**:

```js
// bundler (Vite/webpack/etc.)
import './theme/reset.css';
import './theme/theme.css';
```

```html
<!-- or plain HTML -->
<link rel="stylesheet" href="/theme/reset.css" />
<link rel="stylesheet" href="/theme/theme.css" />
```

`theme.css` loads `./fonts/JetBrainsMono-Regular.woff2` by a relative path, so
keep `fonts/` next to `theme.css`.

## External dependency: icons

The theme does **not** bundle icons. Components that use them (dismiss `×`, etc.)
expect [Font Awesome](https://fontawesome.com). Add your kit to the host page:

```html
<script src="https://kit.fontawesome.com/YOUR_KIT.js" crossorigin="anonymous"></script>
```

## What's inside

- **`reset.css`** — Josh Comeau's modern CSS reset.
- **`theme.css`** — design tokens (`:root` custom properties), base element
  styles, generic component classes, and layout utilities.

### Design tokens

- Colors: `--color-*` (backgrounds, text, accents, states, buttons, inputs).
- Spacing: `--margin-xxs` … `--margin-xxl`.
- Type scale: `--h1`…`--h6`, `--big`, `--p`, `--small`, `--smaller`; fonts
  `--ff` (body, JetBrains Mono) and `--ffh` (headings).
- `--border-w`, `--hover-overlay`.

### Component classes

`.panel` / `.panel-header`, `.toast` (`.success`/`.error`/`.info`), `.banner`
(`.success`/`.error`/`.prompt`), `.chip` / `.chip-x`, `.combo` / `.combo-list` /
`.combo-item` (`.active`), `.disclosure` (+ `.disclosure-body`), `.grid-2`,
`.btn-flat`, and button variants `button.secondary` / `.danger` / `.success` /
`:disabled`.

### Utilities

Flex (`.flex`, `.col`, `.row`, `.wrap`, `.align-center`, `.justi-*`, `.grow`),
`.gap-*`, state (`.is-active`, `.is-inactive`, `.hover-fill`), `.visually-hidden`.

## Re-theming / overrides

Override any token in your own stylesheet after the imports:

```css
:root {
	--ffh: 'Space Grotesk', sans-serif; /* load your own heading font */
	--color-blue: #82aaff; /* re-tint the accent */
}
```

Base font size is `20px`, scaling to `16px` under 480px. Change on `:root`.
