const watchable = require("./watchableStore")
const isPromise = v => v && v.then

// create a watchable store from store and expose it on a ws server
module.exports = (store, wss) =>
  new Promise((resolve, reject) => {
    wss.on("connection", ws => {
      const send = data => ws.send(JSON.stringify(data))
      const watchableStore = watchable(store, send)
      ws.on("message", str => {
        let data
        try {
          data = JSON.parse(str)
        } catch (err) {
          console.error("error parsing message", str, err)
        }

        let callId
        try {
          callId = data.callId
          const res = watchableStore[data.method](data.arg)
          if (isPromise(res)) {
            res.then(
              v => send({ callId, res: v }),
              err => {
                send({ callId, err: err.message })
                throw err
              }
            )
          } else {
            send({ callId, res })
          }
        } catch (err) {
          console.error("error responding to method call", err)
          send({ callId, err: err.message })
          throw err
        }
      })
      ws.on("close", () => {
        console.log("connection closed", ws.id)
        watchableStore.destroy()
      })
    })
    wss.on("error", reject)
    wss.on("listening", () => resolve(wss))
  })
