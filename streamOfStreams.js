const Readable = require("stream").Readable

// permet de créer une readable stream à partir d'une succession de readers (version simplifiée d'une readable stream)

module.exports = () => {
  const readers = []
  let waiting, write, end
  const rss = Readable()
  const tryToRead = () => {
    const reader = readers[0]
    if (reader) {
      reader(write)
    } else {
      if (end) {
        // end of stream
        rss.push(null)
      }

      // wait for next reader
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

  rss.end = () => {
    if (waiting) rss.push(null)
    else {
      end = true
    }
  }

  return rss
}
