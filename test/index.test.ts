import { test } from 'uvu'
import fs from 'fs'
import assert from 'uvu/assert'
import path from 'path'
import { bundleRequire, jsoncParse, JS_EXT_RE } from '../dist'

test('main', async () => {
  const { mod, dependencies } = await bundleRequire({
    filepath: path.join(__dirname, './fixture/input.ts'),
  })
  assert.equal(mod.default.a.filename.endsWith('a.ts'), true)
  assert.equal(dependencies, ['test/fixture/a.ts', 'test/fixture/input.ts'])
})

test('preserveTemporaryFile', async () => {
  await bundleRequire({
    filepath: path.join(__dirname, './fixture/preserve-temporary-file/input.ts'),
    preserveTemporaryFile: true,
    getOutputFile: (filepath: string) =>
      filepath.replace(JS_EXT_RE, `.bundled.mjs`),
  })
  const outputFile = path.join(__dirname, './fixture/preserve-temporary-file/input.bundled.mjs')
  assert.equal(fs.existsSync(outputFile), true)
  fs.unlinkSync(outputFile)
})

test('ignore node_modules', async () => {
  try {
    await bundleRequire({
      filepath: path.join(__dirname, './fixture/ignore-node_modules/input.ts'),
    })
  } catch (error: any) {
    assert.equal(error.code, 'ERR_MODULE_NOT_FOUND')
  }
})

test('resolve tsconfig paths', async () => {
  const { mod } = await bundleRequire({
    filepath: path.join(__dirname, './fixture/resolve-tsconfig-paths/input.ts'),
    cwd: path.join(__dirname, './fixture/resolve-tsconfig-paths'),
  })
  assert.equal(mod.foo, 'foo')
})

test('jsonc parse', () => {
  assert.equal(
    jsoncParse(`
  
  // some comment
  {
    "foo": "bar" // good
    /* another comment */
  }
  `),
    { foo: 'bar' },
  )
})

test.run()
