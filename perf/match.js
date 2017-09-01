// const shortid = require("shortid")
const epvStore = require("../epvStore")
const { autorun } = require("../obs")
const monitor = (cb, label) => {
  console.log("start", label)
  console.time(label)
  cb()
  console.timeEnd(label)
}

console.time("initData")
const data = new Map()
for (var i = 0; i < 1e7; i++) {
  var e = "pce" + i
  const pv = new Map()
  data.set(e, pv)

  pv.set("id", i)
  pv.set("type", "pce")
  pv.set("ville", i % 2 ? "Paris" : "Marseille")
}
for (var i = 0; i < 1e6; i++) {
  var e = "user" + i
  const pv = new Map()
  data.set(e, pv)

  pv.set("id", i)
  pv.set("type", "user")
  pv.set("ville", i % 2 ? "Paris" : "Marseille")
}

const store = epvStore(data)
console.timeEnd("initData")

autorun(() => {
  console.time("autorun")
  const parisPces = store.getEntitiesMatching({ type: "pce", ville: "Paris" })
  console.log("parisPces count", parisPces.length)
  console.timeEnd("autorun")
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
