const Readable = require("stream").Readable

module.exports = () => {
  const readers = []
  let waiting, write
  const rss = Readable()
  const tryToRead = () => {
    const read = readers[0]
    if (read) {
      rss.push(read(write))
    } else {
      waiting = read => {
        waiting = null
        rss.push(read(write))
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
  rss.pushReader = rs => {
    readers.push(rs)
    if (waiting) waiting(rs)
  }
  return rss
}
