const shortid = require("shortid")
const log = require("./log").sub("watchableStore")
const autorun = require("kobs").autorun
const create = require("lodash/create")
const initValue = {}

module.exports = (store, send) => {
  const watchStoreId = shortid.generate()
  const unwatchs = new Map()
  const unwatchs2 = new Map()

  const watch = ({ watchId, method = "query", arg }) => {
    if (unwatchs.has(watchId)) {
      log.warn("watchId already active", { watchId })
      return { err: "watchId already in use" }
    }
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
    log.debug("watching", { method, arg })
    return "done"
  }
  const unwatch = ({ watchId }) => {
    const unwatch = unwatchs.get(watchId)
    if (!unwatch) {
      log.warn("unknown watchId", { watchId })
      return "unknown watchId"
    }
    unwatchs.delete(watchId)
    log.debug("stop watching", { watchId })
    unwatch()
    return "done"
  }
  const watch2 = ({ watchId, method, arg }) => {
    const watchId2 = watchStoreId + "/" + watchId // on crée un watchId spécifique au store car le client du modelWorker est commun à tous les stores
    unwatchs2.set(watchId, () => store.unwatch2({ watchId: watchId2 }))
    return store.watch2({ watchId: watchId2, method, arg }, value => {
      send({ watchId, value })
    })
  }
  const unwatch2 = ({ watchId }) => {
    const unwatch = unwatchs2.get(watchId)
    if (!unwatch) {
      log.warn("unknown watchId in unwatchs2", { watchId })
      return "unknown watchId"
    }
    unwatchs2.delete(watchId)
    log.debug("stop watching modelWorker", { watchId })
    unwatch()
    return "done"
  }
  const destroy = () => {
    unwatchs.forEach(unwatch => unwatch())
    unwatchs2.forEach(unwatch => unwatch())
    log.debug("destroyed")
    return "done"
  }

  return create(store, {
    watch,
    unwatch,
    destroy,
    watch2,
    unwatch2,
  })
}
