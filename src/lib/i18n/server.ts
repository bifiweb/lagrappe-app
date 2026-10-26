import { cookies, headers } from 'next/headers'
import { detectLang, LANG_COOKIE, translate } from './core'

export function getServerLang() {
  return detectLang(cookies().get(LANG_COOKIE)?.value, headers().get('accept-language'))
}

export function tServer(fr: string, vars?: Record<string, string | number>) {
  return translate(getServerLang(), fr, vars)
}
