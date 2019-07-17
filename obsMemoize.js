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

module.exports = (fn, name, hash) => {
  const cache = new Map()
  return arg => {
    const key = isString(arg) ? arg : hash ? hash(arg) : JSON.stringify(arg)
    let obs = cache.get(key)
    if (!obs) {
      const compute = debug && name ? log(fn(arg), name + "/" + key) : fn(arg)
      obs = observable(compute, name + "/" + key)
      cache.set(key, obs)
    }
    return obs()
  }
}
