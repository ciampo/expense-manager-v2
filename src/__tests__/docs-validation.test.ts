import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(__dirname, '../..')

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

    const referencedScripts = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = pnpmPattern.exec(allDocs)) !== null) {
      const script = match[1]
      // Skip non-script pnpm commands
      if (
        [
          'install',
          'add',
          'remove',
          'dlx',
          'run',
          'dev',
          'build',
          'preview',
          'deploy',
        ].includes(script)
      ) {
        continue
      }
      // Only check scripts that look like they could be package.json scripts
      // (contain a colon, which is the convention for custom scripts)
      if (script.includes(':')) {
        referencedScripts.add(script)
      }
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
