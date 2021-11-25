import path from 'path'
import fs from 'fs'
import { jsoncParse } from './utils'

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
      return { data: jsoncParse(contents), path: filepath }
    }
    dir = path.dirname(dir)
  }
  return {}
}
