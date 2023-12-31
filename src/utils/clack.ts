import { setTimeout as sleep } from 'node:timers/promises'
import {
  type LogMessageOptions,
  spinner as clack_spinner,
} from '@clack/prompts'
import isUnicodeSupported from 'is-unicode-supported'
import pc from 'picocolors'
import { isCI } from 'std-env'

// TODO: Import from Clack
////////////////////////////////////////////////////////////////////////////////////////////////
const unicode = isUnicodeSupported()

function s(c: string, fallback: string) {
  if (unicode) return c
  return fallback
}

export const S_BAR = s('│', '|')
export const S_ERROR = s('■', 'x')
export const S_INFO = s('●', '•')
export const S_SUCCESS = s('◆', '*')
////////////////////////////////////////////////////////////////////////////////////////////////

export function message(message = '', options: LogMessageOptions = {}) {
  const { symbol = pc.gray(S_BAR) } = options
  const parts = []
  if (message) {
    const [firstLine, ...lines] = message.split('\n')
    parts.push(
      `${symbol}  ${firstLine}`,
      ...lines.map((ln) => `${pc.gray(S_BAR)}  ${ln}`),
    )
  }
  process.stdout.write(`${parts.join('\n')}\n`)
}

// TODO: CI check should be handled by Clack
// https://github.com/natemoo-re/clack/pull/169
export function spinner(ms = 250, silent = false) {
  const spin = clack_spinner()
  return {
    async start(msg: string) {
      if (silent) return

      if (isCI) message(msg, { symbol: pc.green(s('◇', 'o')) })
      else {
        spin.start(msg)
        // so spinner has a chance :)
        if (ms) await sleep(ms)
      }
    },
    stop(msg: string, error: unknown = undefined) {
      if (silent) return

      if (isCI) {
        if (error) message(msg, { symbol: pc.red(S_ERROR) })
        else message(msg, { symbol: pc.green(S_SUCCESS) })
      } else spin.stop(msg, error ? 1 : 0)
    },
  }
}
