// const shortid = require("shortid")
const epvStore = require("../epvStore")
const epvCommonOperators = require("../epvCommonOperators")
const query = require("../query")

const { autorun } = require("kobs")
const monitor = (cb, label) => {
  console.log("start", label)
  console.time(label)
  cb()
  console.timeEnd(label)
}

console.time("initData")
const data = new Map()
for (var i = 0; i < 1e4; i++) {
  var e = "pce" + i
  const pv = new Map()
  data.set(e, pv)

  pv.set("id", i)
  pv.set("type", "pce")
  pv.set("ville", i % 2 ? "Paris" : "Marseille")
}
for (var i = 0; i < 1e4; i++) {
  var e = "user" + i
  const pv = new Map()
  data.set(e, pv)

  pv.set("id", i)
  pv.set("type", "user")
  pv.set("ville", i % 2 ? "Paris" : "Marseille")
}

const store = epvStore(data)
const q = query(epvCommonOperators(store))
console.timeEnd("initData")

autorun(() => {
  console.time("-> Without cascading")
  console.log(
    "Marseille count (without cascading)",
    q([
      {
        entitiesMatching: { type: "pce", ville: "Marseille" },
      },
      "count",
    ])
  )
  console.log(
    "Paris count (without cascading)",
    q([
      {
        entitiesMatching: { type: "pce", ville: "Paris" },
      },
      "count",
    ])
  )
  console.timeEnd("-> Without cascading")

  console.time("-> With cascading")
  console.log(
    "Paris count (with cascading)",
    q([
      { entitiesMatching: { type: "pce" } },
      { entitiesMatching: { ville: "Paris" } },
      "count",
    ])
  )
  console.log(
    "Marseille count (with cascading)",
    q([
      { entitiesMatching: { type: "pce" } },
      { entitiesMatching: { ville: "Marseille" } },
      "count",
    ])
  )
  console.timeEnd("-> With cascading")
})

monitor(
  () => store.patch({ newParisPce: { type: "pce", ville: "Paris" } }),
  "add newParisPce"
)
monitor(
  () => store.patch({ newMarseillePce: { type: "pce", ville: "Marseille" } }),
  "add newMarseillePce"
)
monitor(
  () => store.patch({ newParisUser: { type: "user", ville: "Paris" } }),
  "add newParisUser"
)
