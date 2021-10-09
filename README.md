**💛 You can help the author become a full-time open-source maintainer by [sponsoring him on GitHub](https://github.com/sponsors/egoist).**

---

# bundle-require

[![npm version](https://badgen.net/npm/v/bundle-require)](https://npm.im/bundle-require)

## Use Case

Projects like [Vite](https://vitejs.dev) need to load config files provided by the user, but you can't do it with just `require()` because it's not necessary a CommonJS module, it could also be a `.mjs` or event written in TypeScript, and that's where the `bundle-require` package comes in, it loads the config file regardless what module format it is.

This is implemented by pre-bundling the file with [esbuild](https://esbuild.github.io/) and then loading it with `require()`.

## Install

```bash
npm i bundle-require esbuild
```

`esbuild` is a peer dependency.

## Usage

```ts
import { bundleRequire } from 'bundle-require'

const mod = await bundleRequire({
  filepath: './project/vite.config.ts',
})
```

## License

MIT &copy; [EGOIST](https://github.com/sponsors/egoist)
