const create = require("lodash/create")
const clientRaw = require("./client-raw")

module.exports = (ws) =>
  clientRaw({
    onmessage: (cb) =>
      (ws.onmessage = (message) => {
        // console.log("message received", message)
        const data = JSON.parse(message.data)
        cb(data)
      }),
    send: (msg) => ws.send(JSON.stringify(msg)),
    close: () => {
      ws.close()
    },
    onDisconnect: (cb) => {
      ws.onclose = (err) => {
        if (!err.wasClean) cb()
      }
    },
  })
