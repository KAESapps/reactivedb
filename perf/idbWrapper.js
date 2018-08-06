const compact = arr => arr.filter(v => v)
const IDBStore = require("idb-wrapper")
const data = new Map()

const entitiesCount = 1e1
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

const storeName = "perf"
let db
const dbCcall = (method, arg1, arg2) =>
  new Promise((resolve, reject) => {
    console.log("starting", method)
    console.time(method)
    db[method].apply(db, compact([arg1, arg2, resolve, reject]))
  }).then(res => {
    console.timeEnd(method)
    console.log("done", method, res)
  })
Promise.resolve()
  .then(
    () =>
      new Promise((onStoreReady, onError) => {
        db = new IDBStore({
          storeName,
          autoIncrement: false,
          keyPath: null,
          onStoreReady,
          onError,
        })
      })
  )
  .then(() => dbCcall("clear"))
  .then(() => dbCcall("put", "state", data))
  // .then(() => dbCcall("put", "state2", data))
  .then(() =>
    dbCcall("iterate", {
      keyRange: db.makeKeyRange({ lower: "state", upper: "state" }),
    })
  )
// .then(() => dbCcall("get", "state"))
// .then(() => dbCcall("get", "state2"))
