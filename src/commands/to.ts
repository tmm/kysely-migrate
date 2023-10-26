import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { setTimeout as sleep } from 'node:timers/promises'
import { cancel, isCancel, select, spinner } from '@clack/prompts'
import pc from 'picocolors'

import { findConfig } from '../utils/findConfig.js'
import { getAppliedMigrationsCount } from '../utils/getAppliedMigrationsCount.js'
import { getMigrator } from '../utils/getMigrator.js'
import { loadConfig } from '../utils/loadConfig.js'
import { logResultSet } from '../utils/logResultSet.js'

export type ToOptions = {
  config?: string | undefined
  name?: string | undefined
  root?: string | undefined
}

export async function to(options: ToOptions) {
  // Get cli config file
  const configPath = await findConfig(options, true)

  const config = await loadConfig({ configPath })
  const migrator = getMigrator(config)

  const migrationsDir = config.migrationFolder
  if (!existsSync(migrationsDir)) await mkdir(migrationsDir)

  const migrations = await migrator.getMigrations()

  if (migrations.length === 0) return 'No migrations.'
  if (migrations.length === 1) return 'No enough migrations.'

  let migration: string | symbol
  if (options.name) migration = options.name
  else {
    const lastExecutedMigration = migrations
      .filter((migration) => migration.executedAt)
      .at(-1)
    const lastExecutedMigrationIndex = lastExecutedMigration
      ? migrations.findIndex(
          (migration) => migration.name === lastExecutedMigration.name,
        )
      : -1

    migration = await select({
      message: `Pick a migration to target.${
        lastExecutedMigration
          ? pc.gray(` Current: ${lastExecutedMigration.name}`)
          : ''
      }`,
      options: migrations
        .map((migration, index) => ({
          label: `${migration.name}${
            lastExecutedMigrationIndex > index ? '.down' : '.up'
          }`,
          value: migration.name,
          ...(migration.executedAt
            ? { hint: migration.executedAt.toISOString() }
            : {}),
        }))
        .filter((option) => option.value !== lastExecutedMigration?.name),
    })

    if (isCancel(migration)) {
      cancel('Operation cancelled')
      return process.exit(0)
    }
  }

  const s = spinner()
  s.start('Running migrations')
  // so spinner has a chance :)
  if (config._spinnerMs) await sleep(config._spinnerMs)

  const resultSet = await migrator.migrateTo(migration as string)

  const { error, results = [] } = resultSet
  s.stop('Ran migrations', error ? 1 : 0)

  logResultSet(resultSet)
  return getAppliedMigrationsCount(results)
}
