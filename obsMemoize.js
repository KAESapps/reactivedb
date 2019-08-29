const { observable } = require("kobs")
const isString = require("lodash/isString")
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "dev"
const log = require("./log").sub("obsMemoize")
const trackTime = (fn, name) => () => {
  const startTime = Date.now()
  // log.debug('start computing', {name})
  const res = fn()
  const duration = Date.now() - startTime
  log.debug("computing done", { name, duration })
  return res
}

module.exports = (fn, name, hash) => {
  const cache = new Map()
  return arg => {
    const key = isString(arg) ? arg : hash ? hash(arg) : JSON.stringify(arg)
    let obs = cache.get(key)
    if (!obs) {
      const compute =
        isDev && name ? trackTime(fn(arg), name + "/" + key) : fn(arg)
      obs = observable(compute, name + "/" + key)
      cache.set(key, obs)
    }
    return obs()
  }
}
