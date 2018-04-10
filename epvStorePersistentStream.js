const nodeFs = require("fs")
const { promisify } = require("util")
const fsMove = promisify(nodeFs.rename)
const fs = require("fs-extra")
const path = require("path")
const sanitizeFilename = require("sanitize-filename")
const create = require("lodash/create")
const epvStore = require("./epvStore")
const { set, unset } = require("./kkvHelpers")
const LDJSONStream = require("ld-jsonstream")
const streamOfStreams = require("./streamOfStreams")
const Readable = require("stream").Readable
const gracefulExit = require("./gracefulExit")

const monitor = (timeLabel, task) => () => {
  console.log("start", timeLabel)
  console.time(timeLabel)
  return task().then(res => {
    console.timeEnd(timeLabel)
    return res
  })
}

module.exports = (dirPath, { writePatches = true } = {}) => {
  // auto load
  const data = new Map()
  let noDeltaEntries = false
  const statePath = path.join(dirPath, "current", "state")
  const deltaPath = path.join(dirPath, "current", "delta")
  const patchesPath = path.join(dirPath, "current", "patches")
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
                if (!rowsCount) noDeltaEntries = true
                resolve()
              })
              ls.on("error", reject)
            })
        )
      )
    )
    .then(() => fs.ensureDir(path.join(dirPath, "archives")))
    .then(
      // archive current files (only if there was delta entries)
      monitor("archive current files", () => {
        if (noDeltaEntries) return Promise.resolve()
        return fsMove(
          path.join(dirPath, "current"),
          path.join(
            dirPath,
            "archives",
            sanitizeFilename(new Date().toISOString(), { replacement: "-" })
          )
        )
      })
    )
    .then(() => fs.ensureFile(statePath))
    .then(
      // save current state (only if there was delta entries)
      monitor("save current state", () => {
        if (noDeltaEntries) return Promise.resolve()
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
    .then(() => writePatches && fs.ensureDir(patchesPath))
    .then(() => {
      const store = epvStore(data)
      // auto save
      console.log("enabling auto-save")

      // on ouvre une stream en écriture sur le fichier delta qui doit être vide
      const ws = fs.createWriteStream(path.join(dirPath, "current", "delta"))
      ws.on("error", err =>
        console.error("Erreur de sauvegarde des données", err)
      )

      const rss = streamOfStreams()
      rss.pipe(ws)

      gracefulExit(() => {
        console.log("Finish writing delta file before exit...")
        const promise = new Promise(resolve => ws.on("finish", resolve))
        rss.end()
        return promise
      })

      const patchAndSave = patch => {
        if (writePatches) {
          // save a backup of the patch
          fs.writeFile(
            path.join(
              patchesPath,
              new Date()
                .toISOString()
                .replace(":", "-")
                .replace(":", "-")
            ) + ".json",
            JSON.stringify(patch)
          )
        }
        // start persisting the patch
        const writePromise = new Promise((resolve, reject) => {
          // var timeLabel = "persisting patch"
          // console.time(timeLabel)
          const keys = Object.keys(patch)
          const entriesCount = keys.length
          // console.log("start", timeLabel, entriesCount, "entries")
          if (entriesCount == 0) {
            console.warn("malformed patch", patch)
          }

          let i = 0
          let j = 0
          // let count = 0
          const nextTriplet = () => {
            while (i < entriesCount) {
              const k1 = keys[i]
              const entityPatch = patch[k1]
              const props = Object.keys(entityPatch)
              const propsCount = props.length
              if (propsCount === 0) {
                console.warn("malformed patch for entity", k1, patch)
              }
              while (j < propsCount) {
                const k2 = props[j]
                const v2 = entityPatch[k2]
                j++
                return [k1, k2, v2]
              }
              j = 0
              i++
            }
            return null
          }

          const reader = write => {
            const triplet = nextTriplet()
            if (triplet == null) {
              // console.log(count, "rows writen")
              // console.timeEnd(timeLabel)
              write(null)
              resolve()
            } else {
              write(JSON.stringify(triplet) + "\n")
            }
          }
          rss.pushReader(reader)
        })

        // call memory store patch
        store.patch(patch)

        return writePromise
      }
      return create(store, { patch: patchAndSave })
    })
}
