const localforage = require("localforage")
const { set, unset } = require("./kkvHelpers")
const epvStore = require("./epvStore")
const create = require("lodash/create")

module.exports = dbName => {
  const data = new Map()
  const db = localforage.createInstance({
    name: dbName,
  })
  let loadCount = 0
  return db.ready().then(() => {
    return (
      db
        //auto-load
        .iterate((value, key) => {
          const [k1, k2] = JSON.parse(key)
          set(data, k1, k2, value)
          loadCount++
        })
        .then(() => {
          console.log(`${loadCount} entries from ${dbName} store loaded`)
          const store = epvStore(data)
          const patchAndSave = patch => {
            // call memory store patch
            store.patch(patch)
            // and then persist it
            const keys = Object.keys(patch)
            return Promise.all(
              keys.map(k1 => {
                const subPatch = patch[k1]
                const subKeys = Object.keys(subPatch)
                return Promise.all(
                  subKeys.map(k2 => {
                    const v = subPatch[k2]
                    if (v == null)
                      return db
                        .removeItem(JSON.stringify([k1, k2]))
                        .catch(console.error)
                    return db
                      .setItem(JSON.stringify([k1, k2]), v)
                      .catch(console.error)
                  })
                )
              })
            )
          }
          return create(store, {
            patch: patchAndSave,
            clearAllData: () => db.clear(),
          })
        })
    )
  })
}
