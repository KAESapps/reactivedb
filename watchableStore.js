const autorun = require("./obs").autorun
const create = require("lodash/create")

module.exports = (store, send) => {
  const unwatchs = new Map()

  const watch = query => {
    const watchId = JSON.stringify(query)
    unwatchs.set(
      watchId,
      autorun(() => {
        const value = store.query(query)
        send(JSON.stringify({ watchId, value }))
      })
    )
    console.log("watching query", query)
    return Promise.resolve("done")
  }
  const unwatch = query => {
    const watchId = JSON.stringify(query)
    unwatchs.get(watchId)()
    console.log("stop watching query", query)
    return Promise.resolve("done")
  }
  const destroy = () => {
    unwatchs.forEach(unwatch => unwatch())
    console.log("watchable store destroyed")
    return Promise.resolve("done")
  }

  return create(store, {
    watch,
    unwatch,
    destroy,
  })
}
