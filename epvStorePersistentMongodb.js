const create = require("lodash/create")
const forEach = require("lodash/forEach")
const logError = err => err && console.error(err)
const epvStore = require("./epvStore")
const set = require("./kkvHelpers").set

module.exports = dbPromise =>
  dbPromise.then(db => {
    // auto load
    const timeLabel = "loading data from mongo"
    console.time(timeLabel)
    const data = new Map()
    return new Promise((resolve, reject) => {
      let entries = 0
      db.find().forEach(
        doc => {
          const k1 = doc._id
          forEach(doc, (value, k2) => {
            if (k2 === "_id") return
            entries++
            set(data, k1, k2, value)
          })
        },
        err => {
          if (err) return reject(err)
          console.log("entries loaded", entries)
          console.timeEnd(timeLabel)
          resolve()
        }
      )
    }).then(() => {
      const store = epvStore(data)
      // auto save
      const patchAndSave = patch => {
        // call memory store patch
        store.patch(patch)
        // and then persist it
        var timeLabel = "persisting ops"
        console.log("start", timeLabel, Object.keys(patch).length, "entities")
        console.time(timeLabel)

        const batch = []
        forEach(patch, (k1Patch, k1) => {
          forEach(k1Patch, (v2, k2) => {
            if (v2 == null) {
              batch.push({
                updateOne: {
                  filter: { _id: k1 },
                  update: { $unset: { [k2]: "" } },
                },
              })
            } else {
              batch.push({
                updateOne: {
                  filter: { _id: k1 },
                  update: { $set: { [k2]: v2 } },
                  upsert: true,
                },
              })
            }
          })
        })
        return db.bulkWrite(batch).then(
          () => {
            console.timeEnd(timeLabel)
          },
          err => {
            console.error(err)
            process.exit(1) // est-ce trop violent ?
          }
        )
      }
      return create(store, { patch: patchAndSave })
    })
  })
