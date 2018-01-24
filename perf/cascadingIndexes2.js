// const shortid = require("shortid")
const epvStore = require("../epvStore")
const epvCommonOperators = require("../epvCommonOperators")
const query = require("../query")

const { autorun } = require("kobs")
const monitor = (label, cb) => {
  console.log("start", label)
  label += " =>"
  console.time(label)
  cb()
  console.timeEnd(label)
}

console.time("initData")
const data = new Map()
const size = 24
for (var i = 0; i < size; i++) {
  const pv = new Map()
  data.set(`${i}`, pv)

  pv.set("id", i)
  pv.set("type", i < size / 2 ? "grume" : "planche")
  pv.set("lot", `Lot n°${Math.floor(i / (size / 2 / 4))}`)
  pv.set("essence", i % 2 ? "Chêne" : "Frêne")
  pv.set("diam", 1)
  pv.set("long", 5)
}

// log data
//data.forEach(pv => pv.forEach((v, p) => console.log(p, v)))

const store = epvStore(data)
const q = query(epvCommonOperators(store))
console.timeEnd("initData")

// autorun(() => {
//   monitor(`Diam grume n°${size / 8}`, () =>
//     console.log(
//       "=",
//       q([
//         {
//           constant: `${size / 8}`,
//         },
//         { valueOfProp: "diam" },
//       ])
//     )
//   )
// })
autorun(() => {
  monitor("Vol chêne Lot n°1", () =>
    console.log(
      "=",
      q([
        {
          entitiesMatching: { type: "grume", lot: "Lot n°1", essence: "Chêne" },
        },
        { mapBy: { valueOfProp: "diam" } },
        "sum",
      ])
    )
  )
})
autorun(() => {
  monitor("Vol frêne Lot n°1", () =>
    console.log(
      "=",
      q([
        {
          entitiesMatching: { type: "grume", lot: "Lot n°1", essence: "Frêne" },
        },
        { mapBy: { valueOfProp: "diam" } },
        "sum",
      ])
    )
  )
})

monitor("add Chêne lot 1", () =>
  store.patch({
    newGrume1: { type: "grume", lot: "Lot n°1", essence: "Chêne", diam: 34 },
  })
)
monitor(`change grume ${size / 8}`, () =>
  store.patch({
    [`${size / 8}`]: { diam: 100 },
  })
)
