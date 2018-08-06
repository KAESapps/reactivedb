const compact = arr => arr.filter(v => v)
const { get, set, clear } = require("idb-keyval")
const data = new Map()

const entitiesCount = 1e5
const propsCount = 30

console.time("create-data")
for (var i = 0; i < entitiesCount; i++) {
  const entity = new Map()
  for (var j = 0; j < propsCount; j++) {
    entity.set("prop-key-" + j, "01234567890123456789")
  }
  data.set("entity-key-" + i, entity)
}
console.timeEnd("create-data")

const dbCcall = (method, arg1, arg2) => {
  const name = method.name
  console.log("starting", name)
  console.time(name)
  return method.apply(null, compact([arg1, arg2])).then(res => {
    console.timeEnd(name)
    console.log("done", name, res)
  })
}

Promise.resolve()
  .then(() => dbCcall(clear))
  .then(() => dbCcall(set, "state", data))
  .then(() => dbCcall(get, "state"))
