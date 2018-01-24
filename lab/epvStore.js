module.exports = data => {
  let onChange = []
  return {
    data,
    patch: patch => {
      Object.keys(patch).forEach(i => {
        Object.keys(patch[i]).forEach(p => {
          let e = data.get(i)
          if (!e) {
            data.set(i, (e = new Map()))
          }
          e.set(p, patch[i][p])
        })
      })
      onChange.forEach(cb => cb(patch))
    },
    onChange: cb => {
      onChange.push(cb)
    },
  }
}
