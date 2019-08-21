const get = require("lodash/get")
const watchable = require("./watchableStore")
const isPromise = v => v && v.then
const log = require("./log").sub("wsServer")

// create a watchable store from store and expose it on a ws server
module.exports = (store, wss) =>
  new Promise((resolve, reject) => {
    const logConnectedUsers = () => {
      const names = Array.from(wss.clients).map(ws => ws.userName)
      log.info("connected users", { count: names.length, names })
    }
    wss.on("connection", (ws, req) => {
      const userName = get(req, "credentials.name")
      ws.userName = userName
      const userId = req.userId
      ws.userId = userId
      log.debug("new ws connection for user", userName)
      logConnectedUsers()
      let send = data => {
        try {
          ws.send(JSON.stringify(data))
        } catch (err) {
          log.warn("error sending data to client", err)
        }
      }
      const watchableStore = watchable(store, send)
      ws.on("message", str => {
        let data
        try {
          data = JSON.parse(str)
        } catch (err) {
          log.error("error parsing message", str, err)
        }

        let callId, res
        try {
          callId = data.callId
          res = watchableStore[data.method](data.arg, { user: userId })
        } catch (err) {
          log.error("error responding to method call", err)
          send({ callId, err: err.message })
          throw err
        }
        if (isPromise(res)) {
          return res.then(
            //est-ce que le "return" est utile ?
            v => send({ callId, res: v }),
            err => {
              log.error("error responding to method call", err)
              send({ callId, err: err.message })
              throw err
            }
          )
        } else {
          send({ callId, res })
        }
      })
      ws.on("close", code => {
        const closedByUser = code == 1005
        log.debug("connection closed", { userName, closedByUser })
        logConnectedUsers()
        watchableStore.destroy()
      })
    })
    wss.on("error", reject)
    wss.on("listening", () => resolve(wss))
  })
