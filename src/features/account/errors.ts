import { uz, type StringKey } from '../../i18n/uz'
import type { Translate } from '../../i18n'
import { ApiError } from '../../lib/api'

/** Turn an API failure into a sentence in the learner's language. Unknown codes fall back to a generic message. */
export function errorText(t: Translate, err: unknown): string {
  const code = err instanceof ApiError ? err.code : 'generic'
  const key = `err.${code}`
  return t(key in uz ? (key as StringKey) : 'err.generic')
}
