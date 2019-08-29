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

const get = (map, key1, key2) => {
  const subMap = map.get(key1)
  if (!subMap) return subMap
  return subMap.get(key2)
}
const set = (map, key1, key2, v) => {
  let subMap
  if (map.has(key1)) {
    subMap = map.get(key1)
  } else {
    subMap = new Map()
    map.set(key1, subMap)
  }
  return subMap.set(key2, v)
}

module.exports = (fn, name, hash1, hash2) => {
  const cache = new Map()
  return (arg1, arg2) => {
    const key1 = isString(arg1) ? arg1 : hash1 ? hash1(arg1) : JSON.stringify
    const key2 = isString(arg2) ? arg2 : hash2 ? hash1(arg2) : JSON.stringify
    let obs = get(cache, key1, key2)
    if (!obs) {
      const debugKey = isDev && name ? `${name}/${key1}-${key2}` : undefined
      const compute = debugKey
        ? trackTime(fn(arg1, arg2), debugKey)
        : fn(arg1, arg2)
      obs = observable(compute, debugKey)
      set(cache, key1, key2, obs)
    }
    return obs()
  }
}
