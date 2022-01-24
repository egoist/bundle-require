import fs from 'fs'
import path from 'path'
import { pathToFileURL } from 'url'
import {
  build,
  Loader,
  BuildOptions,
  BuildFailure,
  BuildResult,
  Plugin as EsbuildPlugin,
} from 'esbuild'
import { dynamicImport, guessFormat, jsoncParse } from './utils'
import { loadTsConfig } from './tsconfig'

export const JS_EXT_RE = /\.(mjs|cjs|ts|js|tsx|jsx)$/

function inferLoader(ext: string): Loader {
  if (ext === '.mjs' || ext === '.cjs') return 'js'
  return ext.slice(1) as Loader
}

export { dynamicImport, jsoncParse }

export type RequireFunction = (
  outfile: string,
  ctx: { format: 'cjs' | 'esm' },
) => any

export type GetOutputFile = (filepath: string, format: 'esm' | 'cjs') => string

export interface Options {
  cwd?: string
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
  getOutputFile?: GetOutputFile
  /**
   * Enable watching and call the callback after each rebuild
   */
  onRebuild?: (ctx: {
    err?: BuildFailure
    mod?: any
    dependencies?: string[]
  }) => void

  /** External packages */
  external?: (string | RegExp)[]

  /** A custom tsconfig path to read `paths` option */
  tsconfig?: string

  /**
   * Preserve compiled temporary file for debugging
   * Default to `process.env.BUNDLE_REQUIRE_PRESERVE`
   */
  preserveTemporaryFile?: boolean
}

// Use a random path to avoid import cache
const defaultGetOutputFile: GetOutputFile = (filepath, format) =>
  filepath.replace(
    JS_EXT_RE,
    `.bundled_${Date.now()}.${format === 'esm' ? 'mjs' : 'cjs'}`,
  )

export { loadTsConfig }

export const tsconfigPathsToRegExp = (paths: Record<string, any>) => {
  return Object.keys(paths || {}).map((key) => {
    return new RegExp(`^${key.replace(/\*/, '.*')}$`)
  })
}

export const match = (id: string, patterns?: (string | RegExp)[]) => {
  if (!patterns) return false
  return patterns.some((p) => {
    if (p instanceof RegExp) {
      return p.test(id)
    }
    return id === p || id.startsWith(p + '/')
  })
}

/**
 * An esbuild plugin to mark node_modules as external
 */
export const externalPlugin = ({
  external,
  notExternal,
}: {
  external?: (string | RegExp)[]
  notExternal?: (string | RegExp)[]
} = {}): EsbuildPlugin => {
  return {
    name: 'bundle-require:external',
    setup(ctx) {
      ctx.onResolve({ filter: /.*/ }, async (args) => {
        if (args.path[0] === '.' || path.isAbsolute(args.path)) {
          // Fallback to default
          return
        }

        if (match(args.path, external)) {
          return {
            external: true,
          }
        }

        if (match(args.path, notExternal)) {
          // Should be resolved by esbuild
          return
        }

        // Most like importing from node_modules, mark external
        return {
          external: true,
        }
      })
    },
  }
}

export const replaceDirnamePlugin = (): EsbuildPlugin => {
  return {
    name: 'bundle-require:replace-path',
    setup(ctx) {
      ctx.onLoad({ filter: JS_EXT_RE }, async (args) => {
        const contents = await fs.promises.readFile(args.path, 'utf-8')
        return {
          contents: contents
            .replace(/[^"'\\]\b__filename\b[^"'\\]/g, JSON.stringify(args.path))
            .replace(/[^"'\\]\b__dirname\b[^"'\\]/g, JSON.stringify(path.dirname(args.path)))
            .replace(
              /[^"'\\]\bimport\.meta\.url\b[^"'\\]/g,
              JSON.stringify(`file://${args.path}`),
            ),
          loader: inferLoader(path.extname(args.path)),
        }
      })
    },
  }
}

export async function bundleRequire(options: Options) {
  if (!JS_EXT_RE.test(options.filepath)) {
    throw new Error(`${options.filepath} is not a valid JS file`)
  }

  const preserveTemporaryFile = options.preserveTemporaryFile ?? !!process.env.BUNDLE_REQUIRE_PRESERVE
  const cwd = options.cwd || process.cwd()
  const format = guessFormat(options.filepath)
  const tsconfig = loadTsConfig(options.cwd, options.tsconfig)
  const resolvePaths = tsconfigPathsToRegExp(
    tsconfig.data?.compilerOptions?.paths || {},
  )

  const extractResult = async (result: BuildResult) => {
    if (!result.outputFiles) {
      throw new Error(`[bundle-require] no output files`)
    }

    const { text } = result.outputFiles[0]

    const getOutputFile = options.getOutputFile || defaultGetOutputFile
    const outfile = getOutputFile(options.filepath, format)

    await fs.promises.writeFile(outfile, text, 'utf8')

    let mod: any
    const req: RequireFunction = options.require || dynamicImport
    try {
      mod = await req(
        format === 'esm' ? pathToFileURL(outfile).href : outfile,
        { format },
      )
    } finally {
      if (!preserveTemporaryFile) {
        // Remove the outfile after executed
        await fs.promises.unlink(outfile)
      }
    }

    return {
      mod,
      dependencies: result.metafile ? Object.keys(result.metafile.inputs) : [],
    }
  }

  const result = await build({
    ...options.esbuildOptions,
    entryPoints: [options.filepath],
    absWorkingDir: cwd,
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
      externalPlugin({
        external: options.external,
        notExternal: resolvePaths,
      }),
      replaceDirnamePlugin(),
    ],
  })

  return extractResult(result)
}
