import fs from 'fs'
import path from 'path'
import { build, Loader, BuildOptions } from 'esbuild'
import { dynamicImport, getPackagesFromNodeModules, guessFormat } from './utils'

const JS_EXT_RE = /\.(mjs|cjs|ts|js|tsx|jsx)$/

function inferLoader(ext: string): Loader {
  if (ext === '.mjs' || ext === '.cjs') return 'js'
  return ext.slice(1) as Loader
}

export { dynamicImport }

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
   * Get the path to the output file
   * By default we simply replace the extension with `.bundled.js`
   */
  getOutputFile?: (filepath: string) => string
}

// Use a random path to avoid import cache
const defaultGetOutputFile = (filepath: string) =>
  filepath.replace(JS_EXT_RE, `.bundled_${Date.now()}.js`)

export async function bundleRequire(options: Options) {
  if (!JS_EXT_RE.test(options.filepath)) {
    throw new Error(`${options.filepath} is not a valid JS file`)
  }

  const getOutputFile = options.getOutputFile || defaultGetOutputFile
  const outfile = getOutputFile(options.filepath)

  const packageNames = getPackagesFromNodeModules()

  const result = await build({
    ...options.esbuildOptions,
    entryPoints: [options.filepath],
    outfile: 'out.js',
    format: guessFormat(options.filepath),
    platform: 'node',
    sourcemap: 'inline',
    bundle: true,
    metafile: true,
    write: false,
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

  if (!result.outputFiles) {
    throw new Error(`[bundle-require] no output files`)
  }

  const { text } = result.outputFiles[0]

  await fs.promises.writeFile(outfile, text, 'utf8')

  let mod: any
  const req = options.require || dynamicImport
  try {
    mod = await req(outfile)
  } finally {
    // Remove the outfile after executed
    await fs.promises.unlink(outfile)
  }

  return {
    mod,
    dependencies: result.metafile ? Object.keys(result.metafile.inputs) : [],
  }
}
