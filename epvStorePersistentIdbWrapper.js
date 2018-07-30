const IDBStore = require("idb-wrapper")
const { set, unset } = require("./kkvHelpers")
const epvStore = require("./epvStore")
const create = require("lodash/create")

module.exports = storeName => {
  const data = new Map()
  let db
  let loadCount = 0

  return new Promise((resolve, reject) => {
    db = new IDBStore({
      storeName,
      autoIncrement: false,
      onStoreReady: resolve,
      keyPath: null,
      onError: reject,
    })
  })
    .then(
      () =>
        new Promise((resolve, reject) => {
          //auto-load
          db.iterate(
            (value, { primaryKey: key }) => {
              const [k1, k2] = JSON.parse(key)
              set(data, k1, k2, value)
              loadCount++
            },
            {
              onError: reject,
              onEnd: resolve,
            }
          )
        })
    )
    .then(() => {
      console.log(`${loadCount} entries from ${storeName} store loaded`)
      const store = epvStore(data)
      const patchAndSave = patch => {
        // call memory store patch
        store.patch(patch)
        // and then persist it
        Object.keys(patch).forEach((k1, i) => {
          const batch = []
          const subPatch = patch[k1]
          const subKeys = Object.keys(subPatch)
          subKeys.forEach(k2 => {
            const key = JSON.stringify([k1, k2])
            const value = subPatch[k2]
            if (value == null) {
              batch.push({ type: "remove", key })
            } else {
              batch.push({ type: "put", key, value })
            }
          })
          setTimeout(
            () =>
              db.batch(
                batch,
                () => console.log(`patch key persisted`, i),
                err => console.error("error persisting patch", i, err)
              ),
            i
          )
        })
      }
      return create(store, {
        patch: patchAndSave,
        clearAllData: () =>
          new Promise((resolve, reject) => {
            db.clear(resolve, reject)
          }),
      })
    })
}
