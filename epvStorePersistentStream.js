const fs = require("fs")
const Readable = require("stream").Readable
const create = require("lodash/create")
const forEach = require("lodash/forEach")
const logError = err => err && console.error(err)
const epvStore = require("./epvStore")
const set = require("./kkvHelpers").set
var LDJSONStream = require("ld-jsonstream")

// storage must conform to the flat-file-db interface
module.exports = db => {
  // auto load
  const data = new Map()
  return new Promise((resolve, reject) => {
    const rs = fs.createReadStream(db, { encoding: "utf8" })
    const ls = new LDJSONStream()
    rs.pipe(ls)
    ls.on("data", ([k1, k2, value]) => set(data, k1, k2, value))
    ls.on("end", () => resolve(epvStore(data)))
    ls.on("error", err => console.error(err) && reject(err))
  }).then(store => {
    // auto save
    const patchAndSave = patch => {
      // call memory store patch
      store.patch(patch)
      // and then persist it
      var timeLabel = "persisting data"
      console.log("start", timeLabel, data.size, "entities")
      console.time(timeLabel)

      const rs = Readable()
      const ws = fs.createWriteStream(db)
      rs.pipe(ws)
      const entries = data.entries()
      rs._read = () => {
        const { done, value } = entries.next()
        if (done) return rs.push(null)
        const [k1, entity] = value
        entity.forEach((v2, k2) => rs.push(JSON.stringify([k1, k2, v2]) + "\n"))
      }

      return new Promise((resolve, reject) => {
        ws.once("finish", () => {
          console.timeEnd(timeLabel)
          resolve()
        })
        ws.on("error", err => console.error(err) && reject(err))
      })
    }
    return create(store, { patch: patchAndSave })
  })
}
