const log = require("./log").sub("storeIdbKeyVal")
// p-pipe 1.2.0 car n'utilise pas de async ni de spread
const pPipe = function(input) {
  const args = Array.isArray(input) ? input : arguments

  if (args.length === 0) {
    return Promise.reject(new Error("Expected at least one argument"))
  }

  return [].slice.call(args, 1).reduce((a, b) => {
    return function() {
      return Promise.resolve(a.apply(null, arguments)).then(b)
    }
  }, args[0])
}
const ctxAssign = (variable, fn) => ctx => {
  if (!fn) return { [variable]: ctx }
  if (!ctx) ctx = {}
  return fn(ctx).then(res => {
    if (variable) {
      ctx[variable] = res
    }
    return ctx
  })
}
const compact = require("lodash/compact")
const mapValues = require("lodash/mapValues")
const groupBy = require("lodash/groupBy")
const padStart = require("lodash/padStart")
const { Store, get, set, del, clear, keys } = require("idb-keyval")
const epvStore = require("./epvStore")
const { patch: patchData } = require("./kkvHelpers")
const create = require("lodash/create")
const { observable } = require("kobs")
const dbCall = (db, method, arg1, arg2) => {
  // const callName = method.name
  // console.log("starting", callName)
  // console.time(callName)
  return method.apply(null, compact([arg1, arg2, db])).then(res => {
    // console.timeEnd(callName)
    // console.log("done", callName, res)
    return res
  })
}
const spy = fn => v => {
  fn(v)
  return v
}

const patchKey = (storeName, patchCount) =>
  storeName + "/" + padStart(patchCount, 5, "0")
const maxPatches = 200

const createDb = arg => {
  if (typeof arg === "string") throw new Error("invalid arg")
  const { dbName, storeName } = arg
  return new Store(dbName, storeName)
}
const ensureInitStore = ({ keys, db }) => {
  if (keys.indexOf("activeStore") >= 0) return Promise.resolve(keys)
  const activeStoreName = new Date().toISOString()
  return dbCall(db, set, patchKey(activeStoreName, 0), {}).then(() =>
    dbCall(db, set, "activeStore", activeStoreName).then(() => [
      "activeStore",
      patchKey(activeStoreName, 0),
    ])
  )
}
const loadStoresMetaData = ({ db, keys }) =>
  dbCall(db, get, "activeStore").then(activeStoreName => {
    const keysByStore = groupBy(keys, k => k.split("/")[0])
    delete keysByStore.activeStore
    const allStores = mapValues(keysByStore, (keys, name) => {
      const patchesToLoad = keys.sort()
      return {
        name,
        patchesCount: patchesToLoad.length,
        patchesToLoad,
      }
    })
    return {
      all: allStores,
      active: allStores[activeStoreName],
    }
  })
const loadActiveStoreData = ({ db, stores }) => {
  const data = new Map()
  const activeStore = stores.active
  return Promise.all(
    activeStore.patchesToLoad.map(k => dbCall(db, get, k))
  ).then(patches => {
    patches.forEach(patch => {
      patchData(data, patch)
    })
    return data
  })
}
const writePatch = (db, store, patch) => {
  const key = patchKey(store.name, store.patchesCount)
  store.patchesCount++
  // return Promise.reject(new Error("fakePersistenceError")) // for test only
  return dbCall(db, set, key, patch)
}
const removeOldStores = (db, stores) =>
  dbCall(db, keys).then(keys => {
    const keysByStore = groupBy(keys, k => k.split("/")[0])
    delete keysByStore.activeStore
    const activeStoreName = stores.active.name
    const initializingStoreName =
      stores.initializing && stores.initializing.name
    const oldStores = Object.keys(keysByStore).filter(
      s => s !== activeStoreName && s !== initializingStoreName
    )
    return Promise.all(
      oldStores.map(store => {
        const keys = keysByStore[store]
        return Promise.all(keys.map(k => dbCall(db, del, k)))
      })
    )
  })
const createNewStore = (db, data, stores) => {
  const storeName = new Date().toISOString()
  const newStore = {
    name: storeName,
    patchesCount: 1,
  }
  stores.initializing = newStore
  stores.all[storeName] = newStore
  return dbCall(db, set, patchKey(storeName, 0), data)
    .then(() => dbCall(db, set, "activeStore", storeName))
    .then(() => {
      stores.active = newStore
      stores.initializing = null
      return removeOldStores(db, stores)
    })
}

//db is idbStore
// store is a virtual store with state and patches
// expect to be called wtih dbName
module.exports = pPipe([
  createDb,
  ctxAssign("db"),
  ctxAssign("keys", ({ db }) => dbCall(db, keys)),
  ctxAssign("keys", ensureInitStore),
  ctxAssign("stores", loadStoresMetaData),
  ctxAssign("data", loadActiveStoreData),
  spy(({ data, stores }) =>
    log("entities loaded from store", {
      count: data.length,
      storeName: stores.active.name,
    })
  ),
  ({ db, data, stores }) => {
    const persisting = observable(0, "persisting")
    const persistenceError = observable(false, "persistenceError")
    const memoryStore = epvStore(data)

    const patchAndSave = patch => {
      // call memory store patch
      memoryStore.patch(patch)
      // and then persist it
      persisting(persisting() + 1)
      writePatch(db, stores.active, patch)
        .then(() => persisting(persisting() - 1))
        .catch(persistenceError)
      // pour les patchs suivant l'initialisation d'un nouveau store, tant que l'opération est encore en cours
      if (stores.initializing) {
        log.debug("new store still initializing when writing patch")
        writePatch(db, stores.initializing, patch).catch(persistenceError)
      }
      if (!stores.initializing && stores.active.patchesCount > maxPatches) {
        createNewStore(db, memoryStore.backup(), stores)
      }
    }
    return create(memoryStore, {
      patch: patchAndSave,
      persisting,
      clearAllData: () => dbCall(db, clear),
      persistenceError,
    })
  },
])
