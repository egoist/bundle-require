import path from 'path'
import fs from 'fs'
import { parse } from 'jsonc-parser'

// Load filename from dir, and recursively search parent dir if not found until it reaches root
export const loadTsConfig = (
  dir = process.cwd(),
  filename = 'tsconfig.json',
) => {
  const { root } = path.parse(dir)
  while (dir !== root) {
    const filepath = path.join(dir, filename)
    if (fs.existsSync(filepath)) {
      const contents = fs.readFileSync(filepath, 'utf8')
      return { data: parse(contents), path: filepath }
    }
    dir = path.dirname(dir)
  }
  return {}
}
