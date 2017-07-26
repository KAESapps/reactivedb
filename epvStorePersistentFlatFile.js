const create = require("lodash/create")
const forEach = require("lodash/forEach")
const logError = err => err && console.error(err)
const epvStore = require("./epvStore")
const set = require("./kkvHelpers").set

// storage must conform to the flat-file-db interface
module.exports = db => {
  // auto load
  return new Promise((resolve, reject) => {
    const data = new Map()
    db.on("load", () => {
      db.forEach((key, value) => {
        const [k1, k2] = JSON.parse(key)
        set(data, k1, k2, value)
      })
      resolve(epvStore(data))
    })
  }).then(store => {
    // auto save
    const patchAndSave = patch => {
      // call memory store patch
      store.patch(patch)
      // and then persist it, via une stream pour une meilleue conso mémoire
      var timeLabel = "persisting ops"
      console.log("start", timeLabel, Object.keys(patch).length, "entities")
      console.time(timeLabel)

      forEach(patch, (k1Patch, k1) => {
        forEach(k1Patch, (v2, k2) => {
          const doubletKey = JSON.stringify([k1, k2])
          if (v2 == null) {
            db.rm(doubletKey)
          } else {
            db.set(doubletKey, v2)
          }
        })
      })
      return new Promise((resolve, reject) => {
        db.on("drain", () => {
          console.timeEnd(timeLabel)
          resolve()
        })
      })
    }
    return create(store, { patch: patchAndSave })
  })
}
