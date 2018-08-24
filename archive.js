var fs = require("fs")
var archiver = require("archiver")
module.exports = (source, destination) =>
  new Promise((resolve, reject) => {
    var output = fs.createWriteStream(destination)
    var archive = archiver("zip", {
      zlib: { level: 9 }, // Sets the compression level.
    })
    output.on("close", function() {
      console.log(archive.pointer() + " total bytes")
      console.log("success archiving", destination)
      resolve()
    })
    output.on("end", function() {
      console.log("Data has been drained")
    })
    archive.on("warning", function(err) {
      if (err.code === "ENOENT") {
        // log warning
        console.warn(err)
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
