const archive = require("./archive")
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
const pRetry = require("p-retry").default
const log = require("./log").sub("epvPersistentStream")

const monitor = (timeLabel, task) => () => {
  log.debug("start", timeLabel)
  const startTime = Date.now()
  return task().then((res) => {
    log.debug(timeLabel, `in ${Date.now() - startTime} ms`)
    return res
  })
}

module.exports = (dirPath, { writePatches = true, disableArchive } = {}) => {
  // auto load
  const data = new Map()
  let noDeltaEntries = false
  const currentPath = path.join(dirPath, "current")
  const statePathTemp = path.join(dirPath, "current", "stateTmp")
  const statePath = path.join(dirPath, "current", "state")
  const deltaPath = path.join(dirPath, "current", "delta")
  const patchesPath = path.join(dirPath, "current", "patches")
  return fs
    .ensureDir(path.join(dirPath, "current"))
    .then(() =>
      fs.pathExists(statePathTemp).then((stateTmpExists) => {
        if (stateTmpExists) {
          log.error("stateTmp exists") //un state temporaire existe (potentiellement partiel lié à un démarrage précédent échoué)
          throw new Error("stateTmp exists")
        }
      })
    )
    .then(
      // load current state file
      monitor("read state file", () =>
        fs.pathExists(statePath).then(
          (stateExists) =>
            stateExists &&
            new Promise((resolve, reject) => {
              let rowsCount = 0
              const rs = fs.createReadStream(statePath, {
                encoding: "utf8",
              })
              const ls = new LDJSONStream({ objectMode: true })
              rs.pipe(ls)
              ls.on("data", ([k1, k2, value]) => {
                set(data, k1, k2, value)
                rowsCount++
              })
              ls.on("end", () => {
                log("state file loaded", { rowsCount })
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
        fs.pathExists(deltaPath).then((deltaExits) => {
          if (!deltaExits) {
            noDeltaEntries = true
            return Promise.resolve()
          }
          return new Promise((resolve, reject) => {
            let rowsCount = 0
            const rs = fs.createReadStream(
              path.join(dirPath, "current", "delta"),
              {
                encoding: "utf8",
              }
            )
            const ls = new LDJSONStream({ objectMode: true })
            rs.pipe(ls)
            ls.on("data", ([k1, k2, value]) => {
              rowsCount++
              return value == null
                ? unset(data, k1, k2)
                : set(data, k1, k2, value)
            })
            ls.on("end", () => {
              log("delta file loaded", { rowsCount })
              if (!rowsCount) noDeltaEntries = true
              resolve()
            })
            ls.on("error", reject)
          })
        })
      )
    )
    .then(() => fs.ensureDir(path.join(dirPath, "archives")))
    .then(
      // archive current files (only if there was delta entries)
      //en dev on bypass l'archivage pour démarrer plus vite
      monitor("archive current files", () => {
        if (disableArchive || noDeltaEntries) return Promise.resolve()
        return archive(
          currentPath,
          path.join(
            dirPath,
            "archives",
            sanitizeFilename(new Date().toISOString(), { replacement: "-" }) +
              ".zip"
          )
        ).then(() => fs.remove(currentPath))
      })
    )
    .then(() =>
      // parfois (sur windows, on a une erreur "EPERM: operation not permitted" et il faut attendre un peu
      pRetry(() =>
        fs.ensureFile(
          disableArchive || noDeltaEntries ? statePath : statePathTemp
        )
      )
    )
    .then(
      // save current state (only if there was delta entries)
      //d'abord dans un fichier temporaire que l'on renommera après (permet de détecter si l'écriture est interrompue)
      monitor("save current state", () => {
        if (disableArchive || noDeltaEntries) return Promise.resolve()
        let count = 0

        const rs = Readable()
        const ws = fs.createWriteStream(statePathTemp)
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
            log("new state file saved", { entries: count })
            resolve()
          })
          ws.on("error", reject)
        }).then(() => fs.move(statePathTemp, statePath))
      })
    )
    .then(() => writePatches && fs.ensureDir(patchesPath))
    .then(() => {
      const store = epvStore(data)
      // auto save
      log.debug("enabling auto-save")

      // on ouvre une stream en écriture sur le fichier delta qui doit être vide
      const ws = fs.createWriteStream(
        deltaPath,
        disableArchive ? { flags: "a" } : undefined
      )
      ws.on("error", (err) =>
        log.error("Erreur de sauvegarde des données", err)
      )

      const rss = streamOfStreams()
      rss.pipe(ws)

      gracefulExit(() => {
        log.warn("Finish writing delta file before exit...")
        const promise = new Promise((resolve) => ws.on("finish", resolve))
        rss.end()
        return promise
      })

      const patchAndSave = (patch) => {
        if (writePatches) {
          // save a backup of the patch
          fs.writeFile(
            path.join(
              patchesPath,
              new Date().toISOString().replace(":", "-").replace(":", "-")
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
            log.warn("empty patch")
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
                log.warn("empty patch for entity", k1)
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

          const reader = (write) => {
            const triplet = nextTriplet()
            if (triplet == null) {
              // console.log(count, "rows writen")
              // console.timeEnd(timeLabel)
              write(null)
              resolve(patch)
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
