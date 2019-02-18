const { observable } = require("kobs")
const identity = require("lodash/identity")

module.exports = (fn, name, hash) => {
  const cache = new Map()
  return arg => {
    const key = hash ? hash(arg) : arg
    let obs = cache.get(key)
    if (!obs) {
      const compute = fn(arg)
      obs = observable(compute, name + "/" + key)
      cache.set(key, obs)
    }
    return obs()
  }
}
