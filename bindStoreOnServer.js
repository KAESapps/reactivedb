const watchable = require("./watchableStore")
const isPromise = v => v && v.then

// create a watchable store from store and expose it on a ws server
module.exports = (store, wss) =>
  new Promise((resolve, reject) => {
    wss.on("connection", ws => {
      let send = data => ws.send(JSON.stringify(data))
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
      ws.on("close", () => {
        console.log("connection closed", ws.id)
        send = data =>
          console.log("data send when connection was already closed", data)
        watchableStore.destroy()
      })
    })
    wss.on("error", reject)
    wss.on("listening", () => resolve(wss))
  })
