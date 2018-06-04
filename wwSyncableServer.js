const watchableStore = require("reactivedb/watchableStore")
const bindStoreOnConnection = require("reactivedb/bindStoreOnConnection")

const verifyConnection = (conn, verify, cb) =>
  conn.onMessage(msg => {
    if (msg.method === "authenticate") {
      verify(msg.arg).then(
        model => {
          conn.onMessage(null)
          conn.postMessage({
            res: { authenticated: model.authenticatedUser() },
          })
          cb(conn, model)
        },
        err => {
          conn.postMessage({ err: err.message })
        }
      )
    }
  })

module.exports = (transport, createModel) =>
  verifyConnection(transport, createModel, (conn, model) =>
    bindStoreOnConnection(watchableStore(model, conn.postMessage), conn)
  )
