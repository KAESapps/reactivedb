const isPromise = (v) => v && v.then

// expose a watchable store on a connection
module.exports = (store, conn) => {
  const send = conn.postMessage
  conn.onMessage((data) => {
    let callId
    try {
      callId = data.callId
      const res = store[data.method](data.arg)
      if (isPromise(res)) {
        res.then(
          (v) => send({ callId, res: v }),
          (err) => send({ callId, err: err ? err.toString() : "error" })
        )
      } else {
        send({ callId, res })
      }
    } catch (err) {
      console.error("error responding to method call", err)
      send({ callId, err: err ? err.toString() : "error" })
      throw err
    }
  })
  conn.onClose &&
    conn.onClose(() => {
      console.log("connection closed", conn.id)
      store.destroy()
    })
}
