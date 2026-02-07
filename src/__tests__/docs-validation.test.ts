import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8')
}

describe('documentation validation', () => {
  it('README script references match package.json scripts', () => {
    const pkg = JSON.parse(readFile('package.json'))
    const readme = readFile('README.md')
    const setupDoc = readFile('docs/SETUP.md')

    const availableScripts = Object.keys(pkg.scripts)

    // Extract `pnpm <script>` references from README and SETUP.md
    const pnpmPattern = /pnpm\s+([\w:.-]+)/g
    const allDocs = readme + '\n' + setupDoc

    // pnpm subcommands that are never package.json scripts
    const pnpmBuiltins = new Set([
      'install',
      'add',
      'remove',
      'dlx',
      'run',
    ])

    const referencedScripts = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = pnpmPattern.exec(allDocs)) !== null) {
      const script = match[1]
      if (pnpmBuiltins.has(script) || script.startsWith('-')) {
        continue
      }
      // Treat all non-builtin pnpm tokens as potential package.json scripts.
      // This ensures typos like `pnpm buld` are caught as missing scripts.
      referencedScripts.add(script)
    }

    const missingScripts = [...referencedScripts].filter(
      (s) => !availableScripts.includes(s)
    )

    expect(missingScripts).toEqual([])
  })

  it('GitHub secrets in README match SETUP.md and ENVIRONMENT_VARIABLES.md', () => {
    const readme = readFile('README.md')
    const setupDoc = readFile('docs/SETUP.md')
    const envDoc = readFile('docs/ENVIRONMENT_VARIABLES.md')

    // Extract secret names from README's secrets table
    const readmeSecrets = new Set<string>()
    const secretTablePattern =
      /\|\s*`([A-Z_]+)`\s*\|.*?\|/g
    let match: RegExpExecArray | null
    while ((match = secretTablePattern.exec(readme)) !== null) {
      // Only capture secrets from the CI/CD section
      if (
        readme.lastIndexOf(
          'GitHub Actions secrets',
          match.index
        ) !== -1
      ) {
        readmeSecrets.add(match[1])
      }
    }

    // Verify all README secrets appear in SETUP.md
    for (const secret of readmeSecrets) {
      expect(setupDoc).toContain(
        secret,
      )
    }

    // Verify all README secrets appear in ENVIRONMENT_VARIABLES.md
    for (const secret of readmeSecrets) {
      expect(envDoc).toContain(
        secret,
      )
    }
  })
})
