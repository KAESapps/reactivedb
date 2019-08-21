var fs = require("fs")
var archiver = require("archiver")
const log = require("./log").sub("archive")

module.exports = (source, destination) =>
  new Promise((resolve, reject) => {
    var output = fs.createWriteStream(destination)
    var archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    })
    output.on("close", function() {
      log.debug(archive.pointer() + " total bytes")
      log.debug("success archiving", destination)
      resolve()
    })
    output.on("end", function() {
      log.debug("Data has been drained")
    })
    archive.on("warning", function(err) {
      if (err.code === "ENOENT") {
        // log warning
        log.warn(err)
      } else {
        // throw error
        reject(err)
      }
    })
    archive.on("error", reject)
    archive.pipe(output)
    archive.directory(source, false)
    archive.finalize()
  })
