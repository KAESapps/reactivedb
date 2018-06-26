const { observable } = require("kobs")
const identity = require("lodash/identity")

// const has = (map, key1, key2) => {
//   if (!map.has(key1)) return false
//   const subMap = map.get(key1)
//   return subMap.has(key2)
// }
const get = (map, key1, key2) => {
  const subMap = map.get(key1)
  if (!subMap) return subMap
  return subMap.get(key2)
}
// const del = (map, key1, key2) => {
//   const subMap = map.get(key1)
//   if (!subMap) return console.warn(key1, 'does not exists in', map)
//   return subMap.delete(key2)
// }
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

module.exports = (fn, name, hash1 = identity, hash2 = identity) => {
  const cache = new Map()
  return (arg1, arg2) => {
    const key1 = hash1(arg1)
    const key2 = hash2(arg2)
    let obs = get(cache, key1, key2)
    if (!obs) {
      const compute = fn(arg1, arg2)
      obs = observable(compute, `${name}/${key1}-${key2}`)
      set(cache, key1, key2, obs)
    }
    return obs()
  }
}
