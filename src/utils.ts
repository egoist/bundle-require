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
