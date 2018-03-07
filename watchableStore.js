const autorun = require("kobs").autorun
const create = require("lodash/create")

module.exports = (store, send) => {
  const unwatchs = new Map()

  const watch = ({ watchId, method = "query", arg }) => {
    unwatchs.set(
      watchId,
      autorun(() => {
        const value = store[method](arg)
        send({ watchId, value })
      })
    )
    console.log("watching", method, arg)
    return "done"
  }
  const unwatch = ({ watchId }) => {
    unwatchs.get(watchId)()
    console.log("stop watching", watchId)
    return "done"
  }
  const destroy = () => {
    unwatchs.forEach(unwatch => unwatch())
    console.log("watchable store destroyed")
    return "done"
  }

  return create(store, {
    watch,
    unwatch,
    destroy,
  })
}
