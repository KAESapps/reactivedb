const isFunction = require("lodash/isFunction")
const { Obs } = require("kobs")
const unwatchDelay = 30 * 1000 // server unwatch is called if UI is not observing during 30 seconds

module.exports = (rawClientArg, authenticatedUser) => {
  const queriesCache = new Map()
  const pendingUnwatch = new Map()

  let rawClient

  let onCloseCb

  const onNewRawClient = function(newClient) {
    newClient.timestamp = new Date()
    console.log("new raw client ", newClient, newClient.timestamp)
    // reconnect
    rawClient = newClient
    onCloseCb && rawClient.onClose(onCloseCb)
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

  const onClose = cb => {
    onCloseCb = cb
    rawClient.onClose(cb)
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
    onClose,
    query: q => watch("query", q),
    queryOnce: proxyRawMethod("query"),
    patch: proxyRawMethod("patch"),
  }
}
