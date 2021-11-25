import { test } from 'uvu'
import assert from 'uvu/assert'
import path from 'path'
import { bundleRequire } from '../dist'

test('main', async () => {
  const { mod, dependencies } = await bundleRequire({
    filepath: path.join(__dirname, './fixture/input.ts'),
  })
  assert.equal(mod.default.a.filename.endsWith('a.ts'), true)
  assert.equal(dependencies, ['test/fixture/a.ts', 'test/fixture/input.ts'])
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

test.run()
