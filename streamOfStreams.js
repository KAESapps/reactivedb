const Readable = require("stream").Readable

// permet de créer une readable stream à partir d'une succession de readers (version simplifiée d'une readable stream)

module.exports = () => {
  const readers = []
  let waiting, write
  const rss = Readable()
  const tryToRead = () => {
    const reader = readers[0]
    if (reader) {
      reader(write)
    } else {
      waiting = reader => {
        waiting = null
        reader(write)
      }
    }
  }
  write = value => {
    if (value === null) {
      readers.shift() // remove reader from queue
      tryToRead()
    } else {
      rss.push(value)
    }
  }
  rss._read = tryToRead
  rss.pushReader = reader => {
    readers.push(reader)
    if (waiting) waiting(reader)
  }
  return rss
}
