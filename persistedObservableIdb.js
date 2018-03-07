var level = require("level-browserify")
const db = level("persistedObservables", { valueEncoding: "json" })
const { Obs } = require("kobs")

module.exports = (name, initValue) =>
  new Promise(resolve => {
    db.get(name, (err, value) => {
      const obs = new Obs(err ? initValue : value, null, null, name)
      const setAndPersist = newValue => {
        db.put(
          name,
          newValue,
          err => err && console.error("Error persiting value", err)
        )
        obs.set(newValue)
      }
      resolve(function(arg) {
        return arguments.length ? setAndPersist(arg) : obs.get()
      })
    })
  })
