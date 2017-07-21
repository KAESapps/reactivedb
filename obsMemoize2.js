const { observable } = require('ks-data/obs')

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

module.exports = fn => {
  const cache = new Map()
  return (key1, key2) => {
    let obs = get(cache, key1, key2)
    if (!obs) {
      const compute = fn(key1, key2)
      obs = observable(compute)
      set(cache, key1, key2, obs)
    }
    return obs()
  }
}
