import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { cancel, confirm, isCancel } from '@clack/prompts'
import { type MigrationResultSet } from 'kysely'

import { spinner } from '../utils/clack.js'
import { findConfig } from '../utils/findConfig.js'
import { getAppliedMigrationsCount } from '../utils/getAppliedMigrationsCount.js'
import { getMigrator } from '../utils/getMigrator.js'
import { loadConfig } from '../utils/loadConfig.js'
import { logResultSet } from '../utils/logResultSet.js'

export type DownOptions = {
  config?: string | undefined
  reset?: boolean | undefined
  root?: string | undefined
}

export async function down(options: DownOptions) {
  // Get cli config file
  const configPath = await findConfig(options, true)

  const config = await loadConfig({ configPath })
  const migrator = getMigrator(config)

  const migrationsDir = config.migrationFolder
  if (!existsSync(migrationsDir)) await mkdir(migrationsDir)

  const migrations = await migrator.getMigrations()
  const executedMigrations = migrations.filter((m) => m.executedAt)

  if (executedMigrations.length === 0) return 'No migrations executed.'

  if (options.reset) {
    const shouldContinue = await confirm({
      message: 'Do you want to continue and reset all migrations?',
    })
    if (isCancel(shouldContinue)) {
      cancel('Operation cancelled')
      return process.exit(0)
    }
    if (!shouldContinue) return 'Applied 0 migrations.'
  }

  const s = spinner(config._spinnerMs)
  await s.start('Running migrations')

  let resultSet: MigrationResultSet
  if (options.reset) {
    // migrator.migrateTo(NO_MIGRATIONS) throwing when run with linked package so handling manually
    const migration = migrations[0]!
    resultSet = await migrator.migrateTo(migration.name)
    if (!resultSet.error) {
      const { results } = await migrator.migrateDown()
      resultSet.results!.push(...(results ?? []))
    }
  } else resultSet = await migrator.migrateDown()

  const { error, results = [] } = resultSet
  s.stop('Ran migrations', error ? 1 : 0)

  logResultSet(resultSet)

  if (error) throw new Error('Failed running migrations.')
  return getAppliedMigrationsCount(results)
}
