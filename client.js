const isFunction = require("lodash/isFunction")
const get = require("lodash/get")
const each = require("lodash/each")
const { Obs, observable, observeSync } = require("kobs")
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
const startWatching = (rawClient, watchId, method, arg, obs, suffix) => {
  const watchMethod = suffix ? "watch2" : "watch"
  rawClient[watchMethod]({ watchId, method, arg }, value => {
    if (value !== get(obs, "value.value")) {
      // évite de déclencher si la valeur reste identique (normalement c'est déjà filtré par le serveur mais c'est utile à la reconnection)
      obs.set({ loaded: true, value })
    }
  }).catch(err => {
    console.error("Error starting to watch", arg, err)
  })
}
const createWatch = (rawClientObs, suffix) => {
  const queriesCache = new Map()
  const pendingUnwatch = new Map()

  // relaunch watched queries for each new rawClient
  observeSync(rawClientObs, rawClient => {
    queriesCache.forEach((obs, watchId) => {
      const { method, arg } = JSON.parse(watchId)
      startWatching(rawClient, watchId, method, arg, obs, suffix)
    })
  })

  const watch = (method, arg) => {
    const watchId = JSON.stringify({ method, arg })
    let obs = queriesCache.get(watchId)
    const cancelPendingUnwatch = pendingUnwatch.get(watchId)
    if (cancelPendingUnwatch) {
      clearTimeout(cancelPendingUnwatch)
    }
    if (!obs) {
      const unwatch = () => {
        const unwatchFn = rawClientObs()[suffix ? "unwatch2" : "unwatch"]
        unwatchFn({ watchId }).catch(err => {
          console.error("Error stopping to watch", method, arg, err)
        })
        queriesCache.delete(watchId)
        pendingUnwatch.delete(watchId)
        //console.log("unwatched query", q)
      }
      const onUnobserved = () => {
        pendingUnwatch.set(watchId, setTimeout(unwatch, unwatchDelay))
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
      startWatching(rawClientObs(), watchId, method, arg, obs, suffix)
    }
    return obs.get()
  }

  return watch
}

module.exports = (rawClientArg, authenticatedUser) => {
  const rawClientObs = observable()
  if (isFunction(rawClientArg)) {
    // rawClientArg is a function that pulses when a new rawClient should be used
    rawClientArg(newClient => {
      const rawClient = rawClientObs()
      rawClient && rawClient.close && rawClient.close() //normalement rawClient est déconnecté mais par sécurité
      console.log("new raw client ", newClient.timestamp)
      rawClientObs(newClient)
    })
  } else {
    // if not a function, then it's a static raw-client
    rawClientObs(rawClientArg)
  }

  const onDisconnect = cb =>
    observeSync(
      rawClientObs,
      rawClient => rawClient && rawClient.onDisconnect(cb)
    )

  const watch = createWatch(rawClientObs)
  const watch2 = createWatch(rawClientObs, "2")

  const proxyRawMethod = method =>
    function() {
      const rawClient = rawClientObs()
      return rawClient[method].apply(rawClient, arguments)
    }

  return {
    authenticatedUser,
    call: proxyRawMethod("call"),
    watch,
    watch2,
    clearLocalData: () => rawClientObs().call("clearLocalData"),
    close: proxyRawMethod("close"),
    onDisconnect,
    query: q => watch("query", q),
    query2: q => watch2("query", q),
    queryOnce: proxyRawMethod("query"),
    queryOnce2: proxyRawMethod("query2"),
    patch: proxyRawMethod("patch"),
    modelCall: (modelPath, arg) => watch("modelCall", { modelPath, arg }),
  }
}
