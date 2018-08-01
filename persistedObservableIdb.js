const IDBStore = require("idb-wrapper")
const getDb = new Promise((resolve, reject) => {
  const db = new IDBStore({
    storeName: "persistedObservables",
    autoIncrement: false,
    onStoreReady: () => resolve(db),
    keyPath: null,
    onError: reject,
  })
})
const { Obs } = require("kobs")

module.exports = (name, initValue) => {
  const obs = new Obs(null, null, null, name)
  return getDb.then(
    db =>
      new Promise((resolve, reject) => {
        db.get(
          name,
          value => {
            obs.set(value || initValue)
            const setAndPersist = newValue => {
              db.put(
                name,
                newValue,
                () => {}, // success
                err => console.error("Error persisting value", err)
              )
              obs.set(newValue)
            }
            resolve(function(arg) {
              return arguments.length ? setAndPersist(arg) : obs.get()
            })
          },
          reject
        )
      })
  )
}
