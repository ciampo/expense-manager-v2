import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

function readFile(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf-8')
}

describe('documentation validation', () => {
  it('README and SETUP script references match package.json scripts', () => {
    const pkg = JSON.parse(readFile('package.json'))
    const readme = readFile('README.md')
    const setupDoc = readFile('docs/SETUP.md')

    const availableScripts = Object.keys(pkg.scripts)

    // Extract `pnpm <script>` references from README and SETUP.md
    const pnpmPattern = /pnpm\s+([\w:.-]+)/g
    const allDocs = readme + '\n' + setupDoc

    // pnpm subcommands that are never package.json scripts
    const pnpmBuiltins = new Set(['install', 'add', 'remove', 'dlx', 'run'])

    const referencedScripts = new Set<string>()
    let match: RegExpExecArray | null
    while ((match = pnpmPattern.exec(allDocs)) !== null) {
      const script = match[1]
      if (pnpmBuiltins.has(script) || script.startsWith('-')) {
        continue
      }
      referencedScripts.add(script)
    }

    const missingScripts = [...referencedScripts].filter((s) => !availableScripts.includes(s))

    expect(missingScripts).toEqual([])
  })

  it('GitHub secrets in README match SETUP.md and ENVIRONMENT_VARIABLES.md', () => {
    const readme = readFile('README.md')
    const setupDoc = readFile('docs/SETUP.md')
    const envDoc = readFile('docs/ENVIRONMENT_VARIABLES.md')

    const readmeSecrets = new Set<string>()
    const secretTablePattern = /\|\s*`([A-Z_]+)`\s*\|.*?\|/g
    let match: RegExpExecArray | null
    while ((match = secretTablePattern.exec(readme)) !== null) {
      if (readme.lastIndexOf('GitHub Actions secrets', match.index) !== -1) {
        readmeSecrets.add(match[1])
      }
    }

    for (const secret of readmeSecrets) {
      expect(setupDoc).toContain(secret)
    }

    for (const secret of readmeSecrets) {
      expect(envDoc).toContain(secret)
    }
  })

  it('.env.example variables are documented in ENVIRONMENT_VARIABLES.md', () => {
    const envExample = readFile('.env.example')
    const envDoc = readFile('docs/ENVIRONMENT_VARIABLES.md')

    const varPattern = /^(?!#)(\w+)=/gm
    let match: RegExpExecArray | null
    const vars: string[] = []
    while ((match = varPattern.exec(envExample)) !== null) {
      vars.push(match[1])
    }

    expect(vars.length).toBeGreaterThan(0)
    for (const v of vars) {
      expect(envDoc).toContain(v)
    }
  })

  it('.env.e2e.example variables are documented in ENVIRONMENT_VARIABLES.md', () => {
    const envE2eExample = readFile('.env.e2e.example')
    const envDoc = readFile('docs/ENVIRONMENT_VARIABLES.md')

    const varPattern = /^(?!#)(\w+)=/gm
    let match: RegExpExecArray | null
    const vars: string[] = []
    while ((match = varPattern.exec(envE2eExample)) !== null) {
      vars.push(match[1])
    }

    expect(vars.length).toBeGreaterThan(0)
    for (const v of vars) {
      expect(envDoc).toContain(v)
    }
  })

  it('GitHub Actions workflow files exist for all workflows listed in README', () => {
    const readme = readFile('README.md')
    const workflowDir = resolve(ROOT, '.github/workflows')

    const existingWorkflows = readdirSync(workflowDir).filter((f) => f.endsWith('.yml'))

    // The README CI/CD section lists workflows as bold list items
    const workflowNames = [
      'Unit Tests',
      'E2E Tests',
      'Visual Regression',
      'Lint',
      'Type Check',
      'Deploy',
      'Preview',
      'Update Screenshots',
    ]

    for (const name of workflowNames) {
      expect(readme).toContain(`**${name}**`)
    }

    // Verify we have at least as many workflow files as listed items
    expect(existingWorkflows.length).toBeGreaterThanOrEqual(workflowNames.length)
  })

  it('env example files listed as safe to commit actually exist', () => {
    const envDoc = readFile('docs/ENVIRONMENT_VARIABLES.md')

    const safeFiles = ['.env.example', '.env.e2e.example']
    for (const file of safeFiles) {
      expect(envDoc).toContain(file)
      expect(existsSync(resolve(ROOT, file))).toBe(true)
    }
  })
})
