const isFunction = require("lodash/isFunction")
const each = require("lodash/each")
const { Obs } = require("kobs")
const unwatchDelay = 30 * 1000 // server unwatch is called if UI is not observing during 30 seconds
const invalidQuery = new Error("invalid-query")
const validateQuery = q => {
  if (!q) throw invalidQuery
  if (typeof q === "string") return
  if (Array.isArray(q)) {
    q.forEach(validateQuery)
    return
  }
  if (typeof q === "object") {
    each(q, v => {
      if (v === undefined) throw invalidQuery
    })
    return
  }
  throw invalidQuery
}
module.exports = (rawClientArg, authenticatedUser) => {
  const queriesCache = new Map()
  const pendingUnwatch = new Map()

  let rawClient

  let onDisconnectCb

  const onNewRawClient = function(newClient) {
    rawClient && rawClient.close && rawClient.close() //normalement rawClient est déconnecté mais par sécurité
    console.log("new raw client ", newClient.timestamp)
    // reconnect
    rawClient = newClient
    onDisconnectCb && rawClient.onDisconnect(onDisconnectCb)
    // relaunch watched queries
    queriesCache.forEach((obs, watchId) => {
      const { method, arg } = JSON.parse(watchId)
      rawClient
        .watch({ watchId, method, arg }, value =>
          obs.set({ loaded: true, value })
        )
        .catch(err => {
          console.error("Error starting to watch", arg, err)
        })
    })
  }

  if (isFunction(rawClientArg)) {
    // rawClientArg is a function that pulses when a new rawClient should be used
    rawClientArg(onNewRawClient)
  } else {
    // if not a function, then it's a static raw-client
    onNewRawClient(rawClientArg)
  }

  const onDisconnect = cb => {
    onDisconnectCb = cb
    rawClient.onDisconnect(cb)
  }

  const watch = (method, arg) => {
    const watchId = JSON.stringify({ method, arg })
    let obs = queriesCache.get(watchId)
    const cancelPendingUnwatch = pendingUnwatch.get(watchId)
    if (cancelPendingUnwatch) {
      clearTimeout(cancelPendingUnwatch)
    }
    if (!obs) {
      const onUnobserved = () => {
        pendingUnwatch.set(
          watchId,
          setTimeout(() => {
            rawClient.unwatch({ watchId }).catch(err => {
              console.error("Error stopping to watch", method, arg, err)
            })
            queriesCache.delete(watchId)
            pendingUnwatch.delete(watchId)
            //console.log("unwatched query", q)
          }, unwatchDelay)
        )
        //console.log("query scheduled to be unwatched", q)
      }
      obs = new Obs(
        { loaded: false, value: undefined },
        onUnobserved,
        null,
        watchId
      )
      queriesCache.set(watchId, obs)
      // start watching server
      if (
        (!process.env.NODE_ENV || process.env.NODE_ENV === "dev") &&
        method === "query"
      )
        validateQuery(arg)
      rawClient
        .watch({ watchId, method, arg }, value =>
          obs.set({ loaded: true, value })
        )
        .catch(err => {
          console.error("Error starting to watch", arg, err)
        })
    }
    return obs.get()
  }

  const proxyRawMethod = method =>
    function() {
      return rawClient[method].apply(rawClient, arguments)
    }

  return {
    authenticatedUser,
    call: proxyRawMethod("call"),
    watch,
    clearLocalData: () => rawClient.call("clearLocalData"),
    close: proxyRawMethod("close"),
    onDisconnect,
    query: q => watch("query", q),
    queryOnce: proxyRawMethod("query"),
    patch: proxyRawMethod("patch"),
  }
}
