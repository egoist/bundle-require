import path from 'path'
import { bundleRequire } from '../src'

test('main', async () => {
  const result = await bundleRequire({
    filepath: path.join(__dirname, './fixture/input.ts'),
  })
  expect(result.default.a.filename.endsWith('a.ts')).toEqual(true)
})
