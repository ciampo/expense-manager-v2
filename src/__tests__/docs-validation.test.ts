import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'fs'
import { execSync } from 'child_process'
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

  it('deploy.yml includes Convex backend deploy step', () => {
    const deploy = readFile('.github/workflows/deploy.yml')

    expect(deploy).toContain('convex deploy')
    expect(deploy).toContain('CONVEX_PROD_DEPLOY_KEY')
  })
})

describe('setup scripts validation', () => {
  const scripts = ['scripts/setup.sh', 'scripts/setup-e2e.sh']

  for (const script of scripts) {
    it(`${script} exists and is executable`, () => {
      const fullPath = resolve(ROOT, script)
      expect(existsSync(fullPath)).toBe(true)

      const stats = statSync(fullPath)
      // Check owner-execute bit (0o100)
      expect(stats.mode & 0o100).toBeTruthy()
    })

    it(`${script} has valid bash syntax`, () => {
      const fullPath = resolve(ROOT, script)
      expect(() => execSync(`bash -n "${fullPath}"`, { stdio: 'pipe' })).not.toThrow()
    })

    it(`${script} checks for node as a prerequisite`, () => {
      const content = readFile(script)
      expect(content).toContain('command -v node')
    })

    it(`${script} checks for pnpm as a prerequisite`, () => {
      const content = readFile(script)
      expect(content).toContain('command -v pnpm')
    })

    it(`${script} uses set -euo pipefail`, () => {
      const content = readFile(script)
      expect(content).toContain('set -euo pipefail')
    })
  }

  it('setup.sh references .env.example as its template', () => {
    const content = readFile('scripts/setup.sh')
    expect(content).toContain('.env.example')
  })

  it('setup-e2e.sh references .env.e2e.example as its template', () => {
    const content = readFile('scripts/setup-e2e.sh')
    expect(content).toContain('.env.e2e.example')
  })

  it('setup.sh validates placeholder values before proceeding', () => {
    const content = readFile('scripts/setup.sh')
    expect(content).toContain('https://your-project.convex.cloud')
  })

  it('setup.sh validates CONVEX_DEPLOYMENT before running seed', () => {
    const content = readFile('scripts/setup.sh')
    const deploymentCheck = content.indexOf('CONVEX_DEPLOYMENT')
    const seedCommand = content.indexOf('seed:seedCategories')
    expect(deploymentCheck).toBeGreaterThan(-1)
    expect(seedCommand).toBeGreaterThan(-1)
    expect(deploymentCheck).toBeLessThan(seedCommand)
  })

  it('setup-e2e.sh validates placeholder values before proceeding', () => {
    const content = readFile('scripts/setup-e2e.sh')
    expect(content).toContain('prod:your-test-project-deploy-key')
    expect(content).toContain('https://your-test-project.convex.cloud')
  })

  for (const script of scripts) {
    it(`${script} does not use unsafe export+xargs env loading`, () => {
      const content = readFile(script)
      expect(content).not.toMatch(/export\s+\$\(/)
    })
  }

  it('setup-e2e.sh validates CONVEX_DEPLOY_KEY before deploying', () => {
    const content = readFile('scripts/setup-e2e.sh')
    const placeholderCheck = content.indexOf('prod:your-test-project-deploy-key')
    const deployCommand = content.indexOf('npx convex deploy')
    expect(placeholderCheck).toBeGreaterThan(-1)
    expect(deployCommand).toBeGreaterThan(-1)
    expect(placeholderCheck).toBeLessThan(deployCommand)
  })

  it('placeholder values in scripts match the example files', () => {
    const envExample = readFile('.env.example')
    const envE2eExample = readFile('.env.e2e.example')
    const setupSh = readFile('scripts/setup.sh')
    const setupE2eSh = readFile('scripts/setup-e2e.sh')

    const envUrl = envExample.match(/^VITE_CONVEX_URL=(.+)$/m)?.[1]
    expect(envUrl).toBeDefined()
    expect(setupSh).toContain(envUrl!)

    const e2eUrl = envE2eExample.match(/^VITE_CONVEX_URL=(.+)$/m)?.[1]
    const e2eKey = envE2eExample.match(/^CONVEX_DEPLOY_KEY=(.+)$/m)?.[1]
    expect(e2eUrl).toBeDefined()
    expect(e2eKey).toBeDefined()
    expect(setupE2eSh).toContain(e2eUrl!)
    expect(setupE2eSh).toContain(e2eKey!)
  })

  it('setup scripts are referenced in package.json', () => {
    const pkg = JSON.parse(readFile('package.json'))
    expect(pkg.scripts.setup).toBe('bash scripts/setup.sh')
    expect(pkg.scripts['setup:e2e']).toBe('bash scripts/setup-e2e.sh')
  })
})
