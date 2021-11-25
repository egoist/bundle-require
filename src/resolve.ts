import { build } from 'esbuild'

export const resolveModule = async (id: string, cwd = process.cwd()) => {
  let moduleId: string | undefined

  await build({
    entryPoints: [id],
    bundle: true,
    format: 'esm',
    outdir: 'dist',
    write: false,
    logLevel: 'silent',
    sourcemap: false,
    absWorkingDir: cwd,
    plugins: [
      {
        name: 'bundle-require-resolve-module',
        setup(build) {
          build.onLoad({ filter: /.*/ }, (args) => {
            moduleId = args.path
            return {
              contents: '',
            }
          })
        },
      },
    ],
  }).catch((err) => {})

  return moduleId
}
