const clientRaw = require("./client-raw")
const { Obs } = require("./obs")
const unwatchDelay = 30 * 1000 // server unwatch is called if UI is not observing during 30 seconds

module.exports = ws => {
  const queriesCache = new Map()
  const pendingUnwatch = new Map()

  const { watch, unwatch, patch, query: queryOnce, onClose, call } = clientRaw(
    ws
  )

  const query = q => {
    const key = JSON.stringify(q)
    let obs = queriesCache.get(key)
    const cancelPendingUnwatch = pendingUnwatch.get(key)
    if (cancelPendingUnwatch) {
      clearTimeout(cancelPendingUnwatch)
    }
    if (!obs) {
      const onUnobserved = () => {
        pendingUnwatch.set(
          key,
          setTimeout(() => {
            unwatch(key).catch(err => {
              console.error("Error stoping to watch query", q, err)
            })
            queriesCache.delete(key)
            pendingUnwatch.delete(key)
            console.log("unwatched query", q)
          }, unwatchDelay)
        )
        console.log("query scheduled to be unwatched", q)
      }
      obs = new Obs(
        { loaded: false, value: undefined },
        onUnobserved,
        null,
        key
      )
      queriesCache.set(key, obs)
      // start watching server
      watch(key, value => obs.set({ loaded: true, value })).catch(err => {
        console.error("Error starting to watch query", q, err)
      })
    }
    return obs.get()
  }

  return { patch, query, queryOnce, onClose, call }
}
