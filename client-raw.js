const shortid = require("shortid")

module.exports = conn => {
  const timestamp = Date.now() // pour du debug
  const resolvers = new Map()
  const listeners = new Map()

  conn.onmessage(data => {
    // console.debug("raw client message", timestamp)
    if (data.callId) {
      const resolver = resolvers.get(data.callId)
      resolvers.delete(data.callId)
      if (!resolver) {
        return console.error("no handler for message", data)
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
        return console.error("no listener for message", data)
      }
      return listener(data.value)
    }
  })

  const call = (method, arg) =>
    new Promise((resolve, reject) => {
      const callId = shortid.generate()
      resolvers.set(callId, { resolve, reject })
      conn.send({
        callId,
        method,
        arg,
      })
    })

  const patch = p => call("patch", p)
  const query = p => call("query", p)
  const query2 = p => call("query2", p)

  const watch = (arg, listener) => {
    listeners.set(arg.watchId, listener)
    return call("watch", arg)
  }
  const watch2 = (arg, listener) => {
    listeners.set(arg.watchId, listener)
    return call("watch2", arg)
  }
  const unwatch = arg => {
    listeners.delete(arg.watchId)
    return call("unwatch", arg)
  }
  const unwatch2 = arg => {
    listeners.delete(arg.watchId)
    return call("unwatch2", arg)
  }

  const close = () => {
    conn.close()
    //TODO: vider les registres ?
  }
  const onDisconnect = cb => {
    conn.onclose = err => {
      if (!err.wasClean) cb()
    }
  }

  return {
    watch,
    watch2,
    unwatch,
    unwatch2,
    query,
    query2,
    call,
    patch,
    close,
    onDisconnect,
    timestamp,
  }
}
