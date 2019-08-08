const fs = require("fs-extra")
const path = require("path")
const create = require("lodash/create")
const epvStore = require("./epvStore")
const { setFromStream } = require("./kkvHelpers")
const LDJSONStream = require("ld-jsonstream")
const streamOfStreams = require("./streamOfStreams")
const Readable = require("stream").Readable
const gracefulExit = require("./gracefulExit")

const log = msg => {
  console.log("[epvStorePersistentLog] " + msg)
}
const monitor = (timeLabel, task) => () => {
  log(`start ${timeLabel}`)
  console.time(timeLabel)
  return task().then(res => {
    console.timeEnd(timeLabel)
    return res
  })
}

module.exports = (dirPath, { withReplica = false } = {}) => {
  // auto load
  const data = new Map()
  let lastStateSeq = null
  let lastLogSeq = null
  const logPath = path.join(dirPath, "log.jsonl")
  const lastStateSeqPath = path.join(dirPath, "lastStateSeq.json")
  const statesPath = path.join(dirPath, "states")
  return fs
    .ensureDir(statesPath)
    .then(() =>
      fs
        .pathExists(lastStateSeqPath)
        .then(lastStateSeqPathExists => {
          if (!lastStateSeqPathExists) return
          lastStateSeq = JSON.parse(
            fs.readFileSync(lastStateSeqPath).toString()
          )
        })
        .then(() => {
          log(`lastStateSeq ${lastStateSeq}`)
        })
    )
    .then(
      // load last state file (if lastStateSeq != null)
      monitor("read last state file", () => {
        if (lastStateSeq == null) return Promise.resolve() // aucun state à charger (attention lastStateSeq peut être à 0)
        const lastStatePath = path.join(statesPath, lastStateSeq + ".jsonl")
        const kkvStream = fs
          .createReadStream(lastStatePath, {
            encoding: "utf8",
          })
          .pipe(new LDJSONStream({ objectMode: true }))
        return setFromStream(data, kkvStream).then(count => {
          log(`${count} rows in state file`)
        })
      })
    )
    .then(
      // load patchs from log file from lastSeq
      monitor("read log file ", () => {
        return fs.pathExists(logPath).then(deltaExits => {
          if (!deltaExits) {
            if (!lastStateSeq) {
              return Promise.resolve() // cas de l'init sans aucun fichier
            } else {
              throw new Error("noLogFile")
            }
          }
          const kkvStream = fs
            .createReadStream(logPath, {
              encoding: "utf8",
              start: lastStateSeq || 0,
            })
            .pipe(new LDJSONStream({ objectMode: true }))
          return setFromStream(data, kkvStream).then(count => {
            log(`${count} rows in log file since ${lastStateSeq}`)
            lastLogSeq = (lastStateSeq || 0) + kkvStream.bytesRead
          })
        })
      })
    )
    .then(
      // save current state (only if there was delta entries)
      monitor("save current state", () => {
        if (!lastLogSeq || lastStateSeq == lastLogSeq) return Promise.resolve()
        let count = 0
        const newStatePath = path.join(statesPath, lastLogSeq + ".jsonl")

        const ws = fs.createWriteStream(newStatePath)
        const rs = Readable()
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
        rs.pipe(ws)

        return new Promise((resolve, reject) => {
          ws.once("finish", () => {
            log(`${count} entries in current state`)
            fs.writeFileSync(lastStateSeqPath, JSON.stringify(lastLogSeq))
            resolve()
          })
          ws.on("error", reject)
        })
      })
    )
    .then(() => {
      const store = epvStore(data)
      // auto save
      // on ouvre une stream en écriture sur le fichier log à la fin
      const ws = fs.createWriteStream(logPath, { flags: "a" })
      ws.on("error", err =>
        console.error("Erreur de sauvegarde des données", err)
      )

      const rss = streamOfStreams()
      rss.pipe(ws)

      gracefulExit(() => {
        log("Finish writing log file before exit...")
        const promise = new Promise(resolve => ws.on("finish", resolve))
        rss.end()
        return promise
      })

      const patchAndSave = (patch, metadata) => {
        if (!metadata) {
          metadata = { ts: new Date().toISOString() }
        }
        // start persisting the patch
        const writePromise = new Promise((resolve, reject) => {
          const keys = Object.keys(patch)
          const entriesCount = keys.length
          if (entriesCount == 0) {
            console.warn("empty patch")
          }

          let i = 0
          let j = 0
          const nextTriplet = () => {
            while (i < entriesCount) {
              const k1 = keys[i]
              const entityPatch = patch[k1]
              const props = Object.keys(entityPatch)
              const propsCount = props.length
              if (propsCount === 0) {
                console.warn("empty patch for entity", k1)
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
              write(JSON.stringify(metadata) + "\n")
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
