const shortid = require("shortid")

module.exports = conn => {
  const resolvers = new Map()
  const listeners = new Map()

  conn.onMessage(data => {
    // console.log("message received", data)
    if (data.callId) {
      const resolver = resolvers.get(data.callId)
      resolvers.delete(data.callId)
      if (!resolver) {
        return console.warn("no handler for call response", data)
      }
      if (data.err) {
        return resolver.reject(data.err)
      } else {
        return resolver.resolve(data.res)
      }
    }
    if (data.watchId) {
      const listener = listeners.get(data.watchId)
      if (!listener) {
        return console.warn("no watch listener for message", data)
      }
      return listener(data.value)
    }
  })

  const call = (method, arg) =>
    new Promise((resolve, reject) => {
      const callId = shortid.generate()
      resolvers.set(callId, { resolve, reject })
      conn.postMessage({
        callId,
        method,
        arg,
      })
    })

  const patch = p => call("patch", p)
  const query = q => call("query", q)

  const watch = (arg, listener) => {
    listeners.set(arg.watchId, listener)
    return call("watch", arg)
  }
  const unwatch = arg => {
    listeners.delete(arg.watchId)
    return call("unwatch", arg)
  }

  const close = () => {
    conn.close && conn.close()
    //TODO: vider les registres ?
  }
  const onClose = conn.onClose

  return { watch, unwatch, query, call, patch, close, onClose }
}
