module.exports = path => {
  return {
    getAll: cb => {},
    set: (k, v) =>
      new Promise((resolve, reject) => {
        if (v == null) {
          return asPromise(fs, "del", k)
        } else {
          return asPromise(fs, "writeFile")
        }
      }),
  }
}
