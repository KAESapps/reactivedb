const isFunction = require("lodash/isFunction")
const get = require("lodash/get")
const each = require("lodash/each")
const { Obs } = require("kobs")
const unwatchDelay = 1000 * 60 * 2 // server unwatch is called if UI is not observing during 2 minutes
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
const startWatching = (rawClient, watchId, method, arg, obs) => {
  rawClient
    .watch({ watchId, method, arg }, value => {
      if (value !== get(obs, "value.value")) {
        // évite de déclencher si la valeur reste identique (normalement c'est déjà filtré par le serveur mais c'est utile à la reconnection)
        obs.set({ loaded: true, value })
      }
    })
    .catch(err => {
      console.error("Error starting to watch", arg, err)
    })
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
      startWatching(rawClient, watchId, method, arg, obs)
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
      ) {
        validateQuery(arg)
      }
      startWatching(rawClient, watchId, method, arg, obs)
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
