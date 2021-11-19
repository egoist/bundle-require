import fs from 'fs'
import path from 'path'
import { build, Loader, BuildOptions, BuildFailure, BuildResult } from 'esbuild'
import { dynamicImport, getPackagesFromNodeModules, guessFormat } from './utils'

const JS_EXT_RE = /\.(mjs|cjs|ts|js|tsx|jsx)$/

function inferLoader(ext: string): Loader {
  if (ext === '.mjs' || ext === '.cjs') return 'js'
  return ext.slice(1) as Loader
}

export { dynamicImport }

export type RequireFunction = (
  outfile: string,
  ctx: { format: 'cjs' | 'esm' },
) => any

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
  require?: RequireFunction
  /**
   * esbuild options
   */
  esbuildOptions?: BuildOptions
  /**
   * Get the path to the output file
   * By default we simply replace the extension with `.bundled.js`
   */
  getOutputFile?: (filepath: string) => string
  /**
   * Enable watching and call the callback after each rebuild
   */
  onRebuild?: (ctx: {
    err?: BuildFailure
    mod?: any
    dependencies?: string[]
  }) => void
}

// Use a random path to avoid import cache
const defaultGetOutputFile = (filepath: string) =>
  filepath.replace(JS_EXT_RE, `.bundled_${Date.now()}.js`)

export async function bundleRequire(options: Options) {
  if (!JS_EXT_RE.test(options.filepath)) {
    throw new Error(`${options.filepath} is not a valid JS file`)
  }

  const packageNames = getPackagesFromNodeModules()
  const format = guessFormat(options.filepath)

  const extractResult = async (result: BuildResult) => {
    if (!result.outputFiles) {
      throw new Error(`[bundle-require] no output files`)
    }

    const { text } = result.outputFiles[0]

    const getOutputFile = options.getOutputFile || defaultGetOutputFile
    const outfile = getOutputFile(options.filepath)

    await fs.promises.writeFile(outfile, text, 'utf8')

    let mod: any
    const req: RequireFunction = options.require || dynamicImport
    try {
      mod = await req(outfile, { format })
    } finally {
      // Remove the outfile after executed
      await fs.promises.unlink(outfile)
    }

    return {
      mod,
      dependencies: result.metafile ? Object.keys(result.metafile.inputs) : [],
    }
  }

  const result = await build({
    ...options.esbuildOptions,
    entryPoints: [options.filepath],
    outfile: 'out.js',
    format,
    platform: 'node',
    sourcemap: 'inline',
    bundle: true,
    metafile: true,
    write: false,
    watch:
      options.esbuildOptions?.watch ||
      (options.onRebuild && {
        async onRebuild(err, result) {
          if (err) {
            return options.onRebuild!({ err })
          }
          if (result) {
            options.onRebuild!(await extractResult(result))
          }
        },
      }),
    plugins: [
      ...(options.esbuildOptions?.plugins || []),
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

  return extractResult(result)
}
