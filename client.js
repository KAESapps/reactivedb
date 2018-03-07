// const clientRaw = require("./client-raw")
const { Obs } = require("kobs")
const unwatchDelay = 30 * 1000 // server unwatch is called if UI is not observing during 30 seconds

module.exports = clientRaw => {
  const queriesCache = new Map()
  const pendingUnwatch = new Map()

  const {
    watch: rawWatch,
    unwatch,
    patch,
    query: queryOnce,
    onClose,
    call,
  } = clientRaw

  const watch = arg => {
    const watchId = JSON.stringify(arg)
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
            unwatch({ watchId }).catch(err => {
              console.error("Error stoping to watch query", q, err)
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
      rawWatch({ watchId, method: arg.method, arg: arg.arg }, value =>
        obs.set({ loaded: true, value })
      ).catch(err => {
        console.error("Error starting to watch", arg, err)
      })
    }
    return obs.get()
  }
  const query = q => watch({ method: "query", arg: q })

  return { patch, query, queryOnce, onClose, call, watch }
}
