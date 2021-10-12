import fs from 'fs'
import path from 'path'
import { build } from 'esbuild'

const JS_EXT_RE = /\.(mjs|cjs|ts|js|tsx|jsx)$/

export interface Options {
  /**
   * The filepath to bundle and require
   */
  filepath: string
  /**
   * The `require` function that is used to load the output file
   * Default to the global `require` function
   * This function can be asynchronous, i.e. returns a Promise
   */
  require?: (outfile: string) => any
}

export async function bundleRequire(options: Options) {
  if (!JS_EXT_RE.test(options.filepath)) {
    throw new Error(`${options.filepath} is not a valid JS file`)
  }

  const outfile = options.filepath.replace(JS_EXT_RE, '.bundled.cjs')
  await build({
    entryPoints: [options.filepath],
    outfile,
    format: 'cjs',
    platform: 'node',
    plugins: [
      {
        name: 'replace-path',
        setup(ctx) {
          ctx.onResolve({ filter: /.*/ }, (args) => {
            if (/node_modules/.test(args.path)) {
              return {
                path: args.path,
                external: true,
              }
            }
            if (path.isAbsolute(args.path) || args.path.startsWith('.')) {
              return {
                path: args.path,
              }
            }
            return {
              path: args.path,
              external: true,
            }
          })

          ctx.onLoad({ filter: JS_EXT_RE }, async (args) => {
            const contents = await fs.promises.readFile(args.path, 'utf-8')
            return {
              contents: contents
                .replace(/\b__filename\b/g, args.path)
                .replace(/\b__dirname\b/g, path.dirname(args.path))
                .replace(/\bimport\.meta\.url\b/g, `file://${args.path}`),
            }
          })
        },
      },
    ],
  })

  let mod: any
  const req = options.require || require
  try {
    mod = await req(outfile)
  } finally {
    // Remove the outfile after executed
    await fs.promises.unlink(outfile)
  }

  return mod
}
