import { httpRouter } from 'convex/server'
import { auth } from './auth'
import { bulkCreateDrafts } from './apiDrafts'

const http = httpRouter()

auth.addHttpRoutes(http)

http.route({
  path: '/api/v1/drafts',
  method: 'POST',
  handler: bulkCreateDrafts,
})

export default http
