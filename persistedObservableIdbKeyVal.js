const { Obs } = require("kobs")
const { createStore, get, set } = require("idb-keyval")

const store = createStore("apinfor-persistedObservables", "0")

module.exports = (name, initValue) => {
  const obs = new Obs(null, null, null, name)
  return get(name, store).then((value) => {
    obs.set(value || initValue)
    const setAndPersist = (newValue) => {
      set(name, newValue, store).catch((err) => {
        console.error("Error persisting value", err)
        throw err
      })
      obs.set(newValue)
    }
    return function (arg) {
      return arguments.length ? setAndPersist(arg) : obs.get()
    }
  })
}
