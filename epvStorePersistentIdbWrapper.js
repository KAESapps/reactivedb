const IDBStore = require("idb-wrapper")
const { set } = require("./kkvHelpers")
const epvStore = require("./epvStore")
const create = require("lodash/create")
const chunk = require("lodash/chunk")
const { observable } = require("kobs")

const tasksQueue = waitingCb => {
  let waitingValue = true
  const waiting = newValue => {
    waitingValue = newValue
    waitingCb && waitingCb(waitingValue)
  }
  const tasks = []
  const execNext = () => {
    if (tasks.length == 0) {
      waiting(true)
      return
    }
    const task = tasks.shift()
    task(execNext)
  }
  const push = task => {
    tasks.push(task)
    if (waitingValue) {
      waiting(false)
      execNext()
    }
  }
  return push
}

module.exports = storeName => {
  const data = new Map()
  let db
  let loadCount = 0
  let persisting = observable(false, "persisting")

  return new Promise((resolve, reject) => {
    db = new IDBStore({
      storeName,
      autoIncrement: false,
      onStoreReady: resolve,
      keyPath: null,
      onError: reject,
    })
  })
    .then(
      () =>
        new Promise((resolve, reject) => {
          //auto-load
          db.iterate(
            (value, { primaryKey: key }) => {
              const [k1, k2] = JSON.parse(key)
              set(data, k1, k2, value)
              loadCount++
            },
            {
              onError: reject,
              onEnd: resolve,
            }
          )
        })
    )
    .then(() => {
      console.log(`${loadCount} entries from ${storeName} store loaded`)
      const store = epvStore(data)
      const scheduleTask = tasksQueue(waiting => persisting(!waiting))

      const patchAndSave = patch => {
        // call memory store patch
        store.patch(patch)
        // and then persist it
        chunk(Object.keys(patch), 100).forEach((keys, i) => {
          const batch = []
          keys.forEach(k1 => {
            const subPatch = patch[k1]
            const subKeys = Object.keys(subPatch)
            subKeys.forEach(k2 => {
              const key = JSON.stringify([k1, k2])
              const value = subPatch[k2]
              if (value == null) {
                batch.push({ type: "remove", key })
              } else {
                batch.push({ type: "put", key, value })
              }
            })
          })
          scheduleTask(next =>
            db.batch(
              batch,
              () => {
                console.log(`patch chunck persisted`, i)
                next()
              },
              err => console.error("error persisting patch chunk", i, err)
            )
          )
        })
      }
      return create(store, {
        patch: patchAndSave,
        persisting,
        clearAllData: () =>
          new Promise((resolve, reject) => {
            db.clear(resolve, reject)
          }),
      })
    })
}
