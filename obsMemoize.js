const { observable } = require("kobs")

module.exports = (fn, name) => {
  const cache = new Map()
  return key => {
    let obs = cache.get(key)
    if (!obs) {
      const compute = fn(key)
      obs = observable(compute, name + "/" + key)
      cache.set(key, obs)
    }
    return obs()
  }
}
