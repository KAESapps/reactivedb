const fs = require("fs-extra")
const path = require("path")
const sanitizeFilename = require("sanitize-filename")
const create = require("lodash/create")
const epvStore = require("./epvStore")
const { set, unset } = require("./kkvHelpers")
const LDJSONStream = require("ld-jsonstream")
const streamOfStreams = require("./streamOfStreams")
const Readable = require("stream").Readable

const monitor = (timeLabel, task) => () => {
  console.log("start", timeLabel)
  console.time(timeLabel)
  return task().then(res => {
    console.timeEnd(timeLabel)
    return res
  })
}

module.exports = dirPath => {
  // auto load
  const data = new Map()
  const statePath = path.join(dirPath, "current", "state")
  const deltaPath = path.join(dirPath, "current", "delta")
  return fs
    .ensureDir(path.join(dirPath, "current"))
    .then(
      // load current state file
      monitor("read state file", () =>
        fs.pathExists(statePath).then(
          stateExists =>
            stateExists &&
            new Promise((resolve, reject) => {
              let rowsCount = 0
              const rs = fs.createReadStream(statePath, {
                encoding: "utf8",
              })
              const ls = new LDJSONStream()
              rs.pipe(ls)
              ls.on("data", ([k1, k2, value]) => {
                set(data, k1, k2, value)
                rowsCount++
              })
              ls.on("end", () => {
                console.log(rowsCount, "rows in state file")
                resolve()
              })
              ls.on("error", reject)
            })
        )
      )
    )
    .then(
      // load current delta file
      monitor("read delta file", () =>
        fs.pathExists(deltaPath).then(
          deltaExits =>
            deltaExits &&
            new Promise((resolve, reject) => {
              let rowsCount = 0
              const rs = fs.createReadStream(
                path.join(dirPath, "current", "delta"),
                {
                  encoding: "utf8",
                }
              )
              const ls = new LDJSONStream()
              rs.pipe(ls)
              ls.on("data", ([k1, k2, value]) => {
                rowsCount++
                return value == null
                  ? unset(data, k1, k2)
                  : set(data, k1, k2, value)
              })
              ls.on("end", () => {
                console.log(rowsCount, "rows in delta file")
                resolve()
              })
              ls.on("error", reject)
            })
        )
      )
    )
    .then(
      // archive current files
      monitor("archive current files", () =>
        fs.move(
          path.join(dirPath, "current"),
          path.join(
            dirPath,
            "archives",
            sanitizeFilename(new Date().toISOString(), { replacement: "-" })
          )
        )
      )
    )
    .then(() => fs.ensureFile(statePath))
    .then(
      // save current state
      monitor("save current state", () => {
        let count = 0

        const rs = Readable()
        const ws = fs.createWriteStream(statePath)
        rs.pipe(ws)
        const entries = data.entries()
        rs._read = () => {
          const { done, value } = entries.next()
          if (done) return rs.push(null)
          const [k1, entity] = value
          entity.forEach((v2, k2) => {
            rs.push(JSON.stringify([k1, k2, v2]) + "\n")
            count++
          })
        }

        return new Promise((resolve, reject) => {
          ws.once("finish", () => {
            console.log(count, "entries in current state")
            resolve()
          })
          ws.on("error", reject)
        })
      })
    )
    .then(() => {
      const store = epvStore(data)
      // auto save
      // on ouvre une stream en écriture sur le fichier delta qui doit être vide
      const ws = fs.createWriteStream(path.join(dirPath, "current", "delta"))
      ws.on("error", err =>
        console.error("Erreur de sauvegarde des données", err)
      )
      const rss = streamOfStreams()
      rss.pipe(ws)

      const patchAndSave = patch => {
        // call memory store patch
        store.patch(patch)
        // and then persist it
        return new Promise((resolve, reject) => {
          // var timeLabel = "persisting patch"
          // console.time(timeLabel)
          const keys = Object.keys(patch)
          const entriesCount = keys.length
          // console.log("start", timeLabel, entriesCount, "entries")

          let i = 0
          let j = 0
          // let count = 0

          const reader = write => {
            if (i === entriesCount) {
              // console.log(count, "rows writen")
              // console.timeEnd(timeLabel)
              write(null)
              resolve()
            } else {
              const k1 = keys[i]
              const entityPatch = patch[k1]
              const props = Object.keys(entityPatch)
              const k2 = props[j]
              const v2 = entityPatch[k2]
              // count++
              j++
              const propsCount = props.length
              if (j === propsCount) {
                j = 0
                i++
              }
              // appel write après la mise à jour des compteurs car cela peut déclencher une nouvelle lecture en synchrone
              write(JSON.stringify([k1, k2, v2]) + "\n")
            }
          }
          rss.pushReader(reader)
        })
      }
      return create(store, { patch: patchAndSave })
    })
}
