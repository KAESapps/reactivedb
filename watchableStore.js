const autorun = require("kobs").autorun
const create = require("lodash/create")
const initValue = {}

module.exports = (store, send) => {
  const unwatchs = new Map()

  const watch = ({ watchId, method = "query", arg }) => {
    let previousValue = initValue
    unwatchs.set(
      watchId,
      autorun(() => {
        let value
        if (arg === undefined) {
          value = store[method]()
        } else {
          value = store[method](arg)
        }
        if (value !== previousValue) {
          // prevent sending value if it is the same as before
          previousValue = value
          send({ watchId, value })
        }
      })
    )
    // console.log("watching", method, arg)
    return "done"
  }
  const unwatch = ({ watchId }) => {
    const unwatch = unwatchs.get(watchId)
    if (!unwatch) {
      console.warn("no watchable store with this id", watchId)
      return
    }
    // console.log("stop watching", watchId)
    unwatch()
    return "done"
  }
  const destroy = () => {
    unwatchs.forEach(unwatch => unwatch())
    // console.log("watchable store destroyed")
    return "done"
  }

  return create(store, {
    watch,
    unwatch,
    destroy,
  })
}
