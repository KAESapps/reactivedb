const get = require("lodash/get")
const watchable = require("./watchableStore")
const isPromise = (v) => v && v.then
const log = require("./log").sub("wsServer")
const keepAliveDelay = 1000 * 30

// create a watchable store from store and expose it on a ws server
module.exports = (store, wss) =>
  new Promise((resolve, reject) => {
    const logConnectedUsers = () => {
      const names = Array.from(wss.clients).map((ws) => ws.userName)
      log.info("userConnectionsChanged", { count: names.length, names })
    }
    wss.on("connection", (ws, req) => {
      const userName = get(req, "credentials.name")
      ws.userName = userName
      const userId = req.userId
      ws.userId = userId
      log.debug("new ws connection for user", userName)
      logConnectedUsers()
      // keep alive
      ws.isAlive = true
      const keepAliveInterval = setInterval(() => {
        if (ws.isAlive === false) return ws.terminate() // déclenche l'événement close avec un code 1006
        ws.ping()
        ws.isAlive = false
      }, keepAliveDelay)
      ws.on("pong", () => {
        ws.isAlive = true
      })

      let send = (data) => {
        ws.send(JSON.stringify(data), (err) => {
          if (err)
            log.warn("error sending data to client", { userId, userName }, err)
        })
      }
      const watchableStore = watchable(store, send)
      ws.on("message", (str) => {
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
          send({ callId, err: err ? err.toString() : "error" })
          throw err
        }
        if (isPromise(res)) {
          return res.then(
            //est-ce que le "return" est utile ?
            (v) => send({ callId, res: v }),
            (err) => {
              log.error("error responding to method call", err)
              send({ callId, err: err ? err.toString() : "error" })
              throw err
            }
          )
        } else {
          send({ callId, res })
        }
      })
      ws.on("close", (code) => {
        // code 1001 : à l'initiative du client
        // code 1005 : closedByUser
        // code 1006 : closedByTerminating
        log.debug("connection closed", { userName, code })
        logConnectedUsers()
        watchableStore.destroy()
        clearInterval(keepAliveInterval)
      })
    })
    wss.on("error", reject)
    resolve(wss)
  })
