const idb = require("idb")
const { set, unset } = require("./kkvHelpers")
const epvStore = require("./epvStore")
const create = require("lodash/create")
const delay = (i, fn) =>
  new Promise((resolve, reject) =>
    setTimeout(() => fn().then(resolve, reject), i)
  )

module.exports = storeName => {
  const data = new Map()
  let loadCount = 0
  let db

  return idb
    .open("data", 1, upgradeDB => {
      upgradeDB.createObjectStore("data")
    })
    .then(res => {
      db = res
      const tx = db.transaction("data", "readonly")
      tx.objectStore("data").iterateCursor(cursor => {
        if (!cursor) return
        const [k1, k2] = JSON.parse(cursor.key)
        set(data, k1, k2, cursor.value)
        loadCount++
        return cursor.continue()
      })
      return tx.complete.catch(err =>
        console.error("error persisting patch", err)
      )
    })
    .then(() => {
      console.log(`${loadCount} entries from ${storeName} store loaded`)
      const store = epvStore(data)
      const patchAndSave = patch => {
        // call memory store patch
        store.patch(patch)
        // and then persist it
        const keys = Object.keys(patch)
        console.log(`patch with ${keys.length} keys`)
        return Promise.all(
          keys.map((k1, i) =>
            delay(i, () => {
              console.log("writing patch key in idb", i)
              const tx = db.transaction("data", "readwrite")
              const idbStore = tx.objectStore("data")
              const subPatch = patch[k1]
              const subKeys = Object.keys(subPatch)
              subKeys.forEach(k2 => {
                const key = JSON.stringify([k1, k2])
                const value = subPatch[k2]
                if (value == null) {
                  idbStore.delete(key)
                } else {
                  idbStore.put(value, key)
                }
              })
              return tx.complete
            })
          )
        )
      }
      return create(store, {
        patch: patchAndSave,
        clearAllData: () => {
          const tx = db.transaction("data", "readwrite")
          const idbStore = tx.objectStore("data")
          idbStore.clear()
          return tx.complete
        },
      })
    })
}
