const clientRaw = require("./client-raw")
const { Obs } = require("kobs")
const unwatchDelay = 30 * 1000 // server unwatch is called if UI is not observing during 30 seconds

module.exports = ws => {
  const queriesCache = new Map()
  const pendingUnwatch = new Map()

  const { watch, unwatch, patch, query: queryOnce, onClose, call } = clientRaw(
    ws
  )

  const query = q => {
    const watchId = JSON.stringify(q)
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
      watch({ watchId, query: q }, value =>
        obs.set({ loaded: true, value })
      ).catch(err => {
        console.error("Error starting to watch query", q, err)
      })
    }
    return obs.get()
  }

  return { patch, query, queryOnce, onClose, call }
}
