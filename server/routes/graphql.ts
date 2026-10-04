import { useDb } from '../lib/db'
import { createApi } from '../lib/schema'

let api: ReturnType<typeof createApi> | undefined

// Every method on /graphql goes to Yoga: POST for queries and mutations, GET
// for the GraphiQL explorer. Yoga answers with its own Response ponyfill, which
// h3 would not recognize if returned directly, hence sendWebResponse.
export default defineEventHandler(async (event) => {
  api ??= createApi(useDb())
  return sendWebResponse(event, await api.fetch(toWebRequest(event)))
})
