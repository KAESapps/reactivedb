const create = require("lodash/create")
const epvStore = require("./epvStore")
const streamOfStreams = require("./streamOfStreams")
var Writable = require("stream").Writable

let count = 0
const fs = {
  createWriteStream: fileName =>
    new Promise((resolve, reject) => {
      var ws = Writable()
      webkitRequestFileSystem(
        1,
        0,
        wkfs => {
          wkfs.root.getFile(
            fileName,
            { create: false, exclusive: true },
            function(fileEntry) {
              fileEntry.createWriter(function(fileWriter) {
                ws._write = function(chunk, enc, next) {
                  // fileWriter.seek(fileWriter.length); // Start write position at EOF.
                  var blob = new Blob([chunk], { type: "text/plain" })
                  fileWriter.write(blob)
                  fileWriter.onwriteend = ev => {
                    console.log("patch line writed", count++)
                    next()
                  }
                  // next()
                }
                resolve(ws)
              }, reject)
            },
            reject
          )
        },
        reject
      )
    }),
}

module.exports = ({ fs, log }) => {
  const data = new Map()
  const store = epvStore(data)
  // on ouvre une stream en écriture sur le fichier delta qui doit être vide
  return fs.createWriteStream("delta").then(ws => {
    // auto save
    console.log("enabling auto-save")

    const rss = streamOfStreams()
    rss.pipe(ws)

    // gracefulExit(() => {
    //   console.log("Finish writing delta file before exit...")
    //   const promise = new Promise(resolve => ws.on("finish", resolve))
    //   rss.end()
    //   return promise
    // })

    const patchAndSave = patch => {
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
