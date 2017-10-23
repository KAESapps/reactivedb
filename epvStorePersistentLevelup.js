var level = require("level-browserify")
const { set, unset } = require("./kkvHelpers")
const epvStore = require("./epvStore")
const create = require("lodash/create")
const warnOnErrorCb = err => {
  if (err) console.error(err)
}

module.exports = dbName => {
  const data = new Map()
  const db = level(dbName, { valueEncoding: "json" })

  let loadCount = 0
  return Promise.resolve()
    .then(
      () =>
        new Promise((resolve, reject) => {
          //auto-load
          db
            .createReadStream()
            .on("data", ({ key, value }) => {
              const [k1, k2] = JSON.parse(key)
              set(data, k1, k2, value)
              loadCount++
            })
            .on("error", reject)
            .on("close", reject)
            .on("end", resolve)
        })
    )
    .then(() => {
      console.log(`${loadCount} entries from ${dbName} store loaded`)
      const store = epvStore(data)
      const patchAndSave = patch => {
        // call memory store patch
        store.patch(patch)
        // and then persist it
        const batch = []
        Object.keys(patch).forEach(k1 => {
          const subPatch = patch[k1]
          const subKeys = Object.keys(subPatch)
          subKeys.forEach(k2 => {
            const key = JSON.stringify([k1, k2])
            const value = subPatch[k2]
            if (value == null) {
              batch.push({ type: "del", key })
            } else {
              batch.push({ type: "put", key, value })
            }
          })
        })
        return new Promise((resolve, reject) => {
          db.batch(batch, err => (err ? reject(err) : resolve()))
        })
      }
      return create(store, {
        patch: patchAndSave,
        clearAllData: () =>
          new Promise((resolve, reject) => {
            db.db.idb.clear(resolve, reject)
          }),
      })
    })
}
