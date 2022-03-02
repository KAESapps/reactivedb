const forEach = require("lodash/forEach")
const fs = require("fs")
const LDJSONStream = require("ld-jsonstream")

exports.get = (store, k1, k2) => {
  const v1 = store.get(k1)
  if (!v1) return null
  const v2 = v1.get(k2)
  return v2 == null ? null : v2
}
const getObject = (exports.get = (store, k1, k2) => {
  const v1 = store[k1]
  if (!v1) return null
  const v2 = v1[k2]
  return v2 == null ? null : v2
})

const set = (exports.set = (store, k1, k2, v) => {
  let v1 = store.get(k1)
  if (!v1) {
    v1 = new Map()
    store.set(k1, v1)
  }
  v1.set(k2, v)
})
const setObject = (exports.setObject = (store, k1, k2, v) => {
  let v1 = store[k1]
  if (!v1) {
    v1 = {}
    store[k1] = v1
  }
  v1[k2] = v
})

exports.unset = (store, k1, k2) => {
  let v1 = store.get(k1)
  if (!v1) return
  v1.delete(k2)
  if (v1.size === 0) store.delete(k1)
}
const unsetObject = (exports.unsetObject = (store, k1, k2) => {
  let v1 = store[k1]
  if (!v1) return
  delete v1[k2]
  if (Object.keys(v1).length === 0) delete store[k1]
})

// mute store (map) en appliquant patch
exports.patch = (store, patch) => {
  forEach(patch, (k1Patch, k1) => {
    let m1 = store.get(k1)
    if (!m1) {
      m1 = new Map()
      store.set(k1, m1)
    }
    forEach(k1Patch, (v2, k2) => {
      if (v2 == null) {
        m1.delete(k2)
      } else {
        m1.set(k2, v2)
      }
    })
    if (m1.size === 0) store.delete(k1)
  })
}

// version plain object de patch
exports.patchObject = (store, patch) => {
  forEach(patch, (k1Patch, k1) => {
    let m1 = store[k1]
    if (!m1) {
      m1 = {}
      store[k1] = m1
    }
    forEach(k1Patch, (v2, k2) => {
      if (v2 == null) {
        delete m1[k2]
      } else {
        m1[k2] = v2
      }
    })
    if (Object.keys(m1).length === 0) delete store[k1]
  })
  return store
}

// source est un map de maps et le résultat est un kkv plain object
const cloneObject = (exports.clone = (source) => {
  const clone = {}
  forEach(source, (kv, k1) => {
    forEach(kv, (v, k2) => {
      if (v == null) return // on ne tient pas compte des null/undefined
      setObject(clone, k1, k2, v)
    })
  })
  return clone
})

// renvoi un patch à appliquer sur source pour obtenir target
// source et target sont des plain objects et non pas des maps
exports.diff = (source, target) => {
  const patch = cloneObject(target)
  // on supprime du clone toutes les valeurs identiques à la source et on met à null, celles qui ont été supprimées
  forEach(source, (kv, k1) => {
    forEach(kv, (v, k2) => {
      const sourceValue = getObject(source, k1, k2)
      if (sourceValue == null) return // si la valeur est null ou undefined on n'en tient pas compte
      const targetValue = getObject(target, k1, k2)
      // cas d'une valeur supprimée
      if (targetValue == null) {
        setObject(patch, k1, k2, null)
        return
      }
      // cas d'une valeur identique
      if (sourceValue === targetValue) {
        unsetObject(patch, k1, k2)
      }
    })
  })
  return patch
}

const tripletsToKkv = (exports.tripletsToKkv = (triplets, kkv) => {
  if (!kkv) kkv = {}
  forEach(triplets, (v) => {
    if (Array.isArray(v[0])) {
      tripletsToKkv(v, kkv) // supporte le nesting
    } else {
      if (!v[0]) return // cas d'un array vide (container de triplets de longeur 0)
      setObject(kkv, v[0], v[1], v[2])
    }
  })
  return kkv
})

const setFromStream = (exports.setFromStream = (store, kkvStream) => {
  return new Promise((resolve, reject) => {
    let rowsRead = 0
    kkvStream.on("data", (data) => {
      if (!Array.isArray(data)) return //ignore non kkv entries
      const [e, p, v] = data
      set(store, e, p, v)
      rowsRead++
    })
    kkvStream.on("end", () => {
      resolve({ rowsRead, bytesRead: kkvStream.bytesRead })
    })
    kkvStream.on("error", reject)
  })
})

exports.loadFromFile = (store, path, start) => {
  const kkvStream = fs
    .createReadStream(path, {
      encoding: "utf8",
      start,
    })
    .pipe(new LDJSONStream({ objectMode: true }))
  return setFromStream(store, kkvStream)
}

// merge le second patch (source) sur le premier (target) en le mutant
exports.mergePatches = (target, source) => {
  forEach(source, (k1Patch, k1) => {
    let m1 = target[k1]
    if (!m1) {
      m1 = {}
      target[k1] = m1
    }
    forEach(k1Patch, (v2, k2) => {
      m1[k2] = v2
    })
  })
  return target
}
