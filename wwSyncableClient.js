const watchableModelClient = require("reactivedb/watchableModelClient")
const client = require("reactivedb/client")

const authenticate = (conn, credentials) =>
  new Promise((resolve, reject) => {
    conn.onMessage(msg => {
      if (msg.res && msg.res.authenticated) {
        conn.onMessage(null)
        resolve([conn, msg.res.authenticated])
      } else if (msg.err) {
        reject(new Error(msg.err))
      }
    })
    conn.postMessage({ method: "authenticate", arg: credentials })
  })

module.exports = transport => {
  return credentials =>
    authenticate(transport, credentials).then(([conn, authenticatedUser]) =>
      client(watchableModelClient(conn), authenticatedUser)
    )
}
