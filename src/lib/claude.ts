import OpenAI from 'openai'

let _client: OpenAI | undefined

// Defer instantiation so the SDK doesn't throw at build time when
// OPENAI_API_KEY is absent from the Vercel build environment.
export const openai = new Proxy({} as OpenAI, {
  get(_, prop: string | symbol) {
    if (!_client) {
      _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    }
    return Reflect.get(_client, prop, _client)
  },
})
