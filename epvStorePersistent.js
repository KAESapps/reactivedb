const create = require("lodash/create")
const forEach = require("lodash/forEach")
const logError = err => err && console.error(err)
const epvStore = require("./epvStore")
const set = require("./kkvHelpers").set
const Readable = require("stream").Readable
const BatchStream = require("batch-stream")
const parallel = require("concurrent-writable")
const LevelBatch = require("level-batch-stream")

// storage must conform to the levelup interface
module.exports = storage => {
  // auto load
  return new Promise((resolve, reject) => {
    const data = new Map()
    storage
      .createReadStream()
      .on("data", ({ key, value }) => {
        const [k1, k2] = JSON.parse(key)
        set(data, k1, k2, value)
      })
      .on("error", reject)
      .on("close", reject)
      .on("end", () => resolve(epvStore(data)))
  }).then(store => {
    // auto save
    const patchAndSave = patch => {
      // call memory store patch
      store.patch(patch)
      // and then persist it, via une stream pour une meilleue conso mémoire
      var timeLabel = "persisting ops"
      console.log("start", timeLabel, Object.keys(patch).length, "entities")
      console.time(timeLabel)
      // const rs = new Readable({ objectMode: true })
      // let i = 0,
      //   keys = Object.keys(patch)
      // rs._read = () => {
      //   if (i >= keys.length) {
      //     console.log("end of patch read")
      //     return rs.push(null)
      //   }
      //   const k1 = keys[i]
      //   console.log("reading key", i, "/", keys.length)
      //   const k1Patch = patch[k1]
      //   forEach(k1Patch, (v2, k2) => {
      //     const doubletKey = JSON.stringify([k1, k2])
      //     if (v2 == null) {
      //       rs.push({ type: "del", key: doubletKey })
      //     } else {
      //       rs.push({ type: "put", key: doubletKey, value: v2 })
      //     }
      //   })
      //   i++
      // }
      // const s = rs
      //   .pipe(new BatchStream({ size: 100 }))
      //   .pipe(parallel(new LevelBatch(storage), 10))

      // forEach(patch, (k1Patch, k1) => {
      //   forEach(k1Patch, (v2, k2) => {
      //     const doubletKey = JSON.stringify([k1, k2])
      //     if (v2 == null) {
      //       rs.push({ type: "del", key: doubletKey })
      //     } else {
      //       rs.push({ type: "put", key: doubletKey, value: v2 })
      //     }
      //   })
      // })
      // rs.push(null)

      // s.on("error", logError)
      // return new Promise(resolve =>
      //   s.on("finish", () => {
      //     console.timeEnd(timeLabel)
      //     resolve()
      //   })
      // )

      // const batch = storage.batch()
      // forEach(patch, (k1Patch, k1) => {
      //   forEach(k1Patch, (v2, k2) => {
      //     const doubletKey = JSON.stringify([k1, k2])
      //     if (v2 == null) {
      //       batch.del(doubletKey)
      //     } else {
      //       batch.put(doubletKey, v2)
      //     }
      //   })
      // })
      // return new Promise((resolve, reject) => {
      //   batch.write(err => {
      //     console.timeEnd(timeLabel)
      //     if (err) return reject(err)
      //     resolve()
      //   })
      // })
    }
    return create(store, { patch: patchAndSave })
  })
}
