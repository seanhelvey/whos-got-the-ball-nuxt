import { useDb } from '../lib/db'

// Create and seed the database when the server boots, not on the first
// request, so a fresh deploy has data before anyone asks for it.
export default defineNitroPlugin(() => {
  useDb()
})
