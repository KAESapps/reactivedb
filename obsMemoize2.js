const { observable } = require("kobs")
const isString = require("lodash/isString")
const debug = !!process.env
const log = (fn, name) => () => {
  const timeName = `computing ${name}`
  console.time(timeName)
  const res = fn()
  console.timeEnd(timeName)
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
      const debugKey = debug && name ? `${name}/${key1}-${key2}` : undefined
      const compute = debugKey ? log(fn(arg1, arg2), debugKey) : fn(arg1, arg2)
      obs = observable(compute, debugKey)
      set(cache, key1, key2, obs)
    }
    return obs()
  }
}
