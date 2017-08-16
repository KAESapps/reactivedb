const autorun = require("./obs").autorun
const create = require("lodash/create")

module.exports = (store, send) => {
  const unwatchs = new Map()

  const watch = watchId => {
    const query = JSON.parse(watchId)
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
  const unwatch = watchId => {
    unwatchs.get(watchId)()
    console.log("stop watching query", watchId)
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
