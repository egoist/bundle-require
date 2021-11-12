import path from 'path'
import { bundleRequire } from '../src'

test('main', async () => {
  const { mod, dependencies } = await bundleRequire({
    filepath: path.join(__dirname, './fixture/input.ts'),
  })
  expect(mod.default.a.filename.endsWith('a.ts')).toEqual(true)
  expect(dependencies).toMatchInlineSnapshot(`
    Array [
      "test/fixture/a.ts",
      "test/fixture/input.ts",
    ]
  `)
})
