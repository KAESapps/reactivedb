const watchable = require("./watchableStore")
const isPromise = v => v && v.then

// create a watchable store from store and expose it on a ws server
module.exports = (store, wss) =>
  new Promise((resolve, reject) => {
    const logConnectedUsers = () => {
      console.log(
        `${wss.clients.size} connected user(s) : ${Array.from(wss.clients).map(
          ws => ws.userName
        )}`
      )
    }
    wss.on("connection", (ws, req) => {
      const userName = req.credentials.name
      ws.userName = userName
      console.log("new ws connection for user", userName)
      logConnectedUsers()
      let send = data => {
        try {
          ws.send(JSON.stringify(data))
        } catch (err) {
          console.warn("error sending data to client", err)
        }
      }
      const watchableStore = watchable(store, send)
      ws.on("message", str => {
        let data
        try {
          data = JSON.parse(str)
        } catch (err) {
          console.error("error parsing message", str, err)
        }

        let callId, res
        try {
          callId = data.callId
          res = watchableStore[data.method](data.arg)
        } catch (err) {
          console.error("error responding to method call", err)
          send({ callId, err: err.message })
          throw err
        }
        if (isPromise(res)) {
          return res.then(
            v => send({ callId, res: v }),
            err => {
              console.error("error responding to method call", err)
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
        console.log("connection closed for user", userName, { closedByUser })
        logConnectedUsers()
        watchableStore.destroy()
      })
    })
    wss.on("error", reject)
    wss.on("listening", () => resolve(wss))
  })
