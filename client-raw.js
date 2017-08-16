const shortid = require("shortid")

module.exports = ws => {
  const resolvers = new Map()
  const listeners = new Map()

  ws.on("message", message => {
    const data = JSON.parse(message)
    // console.log("message received", data)
    if (data.callId) {
      const resolver = resolvers.get(data.callId)
      if (!resolver) {
        return console.error("no handler for message", message)
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
        return console.error("no listener for message", message)
      }
      return listener(data.value)
    }
  })

  const call = (method, arg) =>
    new Promise((resolve, reject) => {
      const callId = shortid.generate()
      resolvers.set(callId, { resolve, reject })
      ws.send(
        JSON.stringify({
          callId,
          method,
          arg,
        })
      )
    })

  const patch = p => call("patch", p)
  const query = p => call("query", p)

  const watch = (query, listener) => {
    listeners.set(query, listener)
    return call("watch", query)
  }
  const unwatch = query => {
    listeners.delete(query)
    return call("unwatch", query)
  }

  const close = () => {
    ws.close()
    //TODO: vider les registres ?
  }

  return { watch, unwatch, query, call, patch, close }
}
