import fs from 'fs'
import path from 'path'

export function getPackagesFromNodeModules(dir = 'node_modules') {
  const result: string[] = []
  const names = fs.existsSync(dir) ? fs.readdirSync(dir) : []
  for (const name of names) {
    if (name[0] === '@') {
      try {
        const subnames = fs.readdirSync(path.join(dir, name))
        for (const subname of subnames) {
          result.push(`${name}/${subname}`)
        }
      } catch (error) {
        result.push(name)
      }
    } else {
      result.push(name)
    }
  }
  return result
}

const getPkgType = (): string | undefined => {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve('package.json'), 'utf-8'),
    )
    return pkg.type
  } catch (error) {}
}

export function guessFormat(inputFile: string): 'esm' | 'cjs' {
  const ext = path.extname(inputFile)
  const type = getPkgType()
  if (ext === '.js' || ext === '.ts') {
    return type === 'module' ? 'esm' : 'cjs'
  } else if (ext === '.mjs') {
    return 'esm'
  }
  return 'cjs'
}

// Stolen from https://github.com/vitejs/vite/blob/0713446fa4df678422c84bd141b189a930c100e7/packages/vite/src/node/utils.ts#L606
export const usingDynamicImport = typeof jest === 'undefined'
/**
 * Dynamically import files. It will make sure it's not being compiled away by TS/Rollup.
 *
 * As a temporary workaround for Jest's lack of stable ESM support, we fallback to require
 * if we're in a Jest environment.
 * See https://github.com/vitejs/vite/pull/5197#issuecomment-938054077
 *
 * @param file File path to import.
 */
export const dynamicImport = usingDynamicImport
  ? new Function('file', 'return import(file)')
  : require
