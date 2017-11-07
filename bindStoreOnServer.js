const watchable = require("./watchableStore")

// create a watchable store from store and expose it on a ws server
module.exports = (store, wss) =>
  new Promise((resolve, reject) => {
    wss.on("connection", ws => {
      const watchableStore = watchable(store, ws.send.bind(ws))
      ws.on("message", str => {
        let data
        try {
          data = JSON.parse(str)
        } catch (err) {
          console.error("error handling message", err)
        }

        let callId
        try {
          callId = data.callId
          const { method, arg } = data
          const res = watchableStore[method](arg)
          ws.send(JSON.stringify({ callId, res }))
        } catch (err) {
          console.error("error responding to method call", err)
          ws.send(JSON.stringify({ callId, err: err.message }))
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
