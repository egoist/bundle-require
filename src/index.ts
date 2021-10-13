import fs from 'fs'
import path from 'path'
import { build, Loader, Plugin, BuildOptions } from 'esbuild'
import { getPackagesFromNodeModules } from './utils'

const JS_EXT_RE = /\.(mjs|cjs|ts|js|tsx|jsx)$/

function inferLoader(ext: string): Loader {
  if (ext === '.mjs' || ext === '.cjs') return 'js'
  return ext.slice(1) as Loader
}

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
  /**
   * esbuild options
   */
  esbuildOptions?: BuildOptions
  /**
   * esbuild plugin
   */
  esbuildPlugins?: Plugin[]
  /**
   * Get the path to the output file
   * By default we simply replace the extension with `.bundled.cjs`
   */
  getOutputFile?: (filepath: string) => string
}

const defaultGetOutputFile = (filepath: string) =>
  filepath.replace(JS_EXT_RE, '.bundled.cjs')

export async function bundleRequire(options: Options) {
  if (!JS_EXT_RE.test(options.filepath)) {
    throw new Error(`${options.filepath} is not a valid JS file`)
  }

  const getOutputFile = options.getOutputFile || defaultGetOutputFile
  const outfile = getOutputFile(options.filepath)

  const packageNames = getPackagesFromNodeModules()

  await build({
    entryPoints: [options.filepath],
    outfile,
    format: 'cjs',
    platform: 'node',
    bundle: true,
    ...options.esbuildOptions,
    plugins: [
      ...(options.esbuildPlugins || []),
      {
        name: 'replace-path',
        setup(ctx) {
          ctx.onResolve({ filter: /.*/ }, (args) => {
            const isPackage = packageNames.some((name) => {
              return args.path === name || args.path.startsWith(`${name}/`)
            })
            if (isPackage) {
              return {
                path: args.path,
                external: true,
              }
            }
          })

          ctx.onLoad({ filter: JS_EXT_RE }, async (args) => {
            const contents = await fs.promises.readFile(args.path, 'utf-8')
            return {
              contents: contents
                .replace(/\b__filename\b/g, JSON.stringify(args.path))
                .replace(
                  /\b__dirname\b/g,
                  JSON.stringify(path.dirname(args.path)),
                )
                .replace(
                  /\bimport\.meta\.url\b/g,
                  JSON.stringify(`file://${args.path}`),
                ),
              loader: inferLoader(path.extname(args.path)),
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
