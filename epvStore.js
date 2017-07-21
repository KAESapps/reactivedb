const { observable, transaction } = require("./obs")
const isObservable = require("lodash/isFunction")
const forEach = require("lodash/forEach")

const getEntitiesFrom = (epv, prop, value) => {
  const entities = []
  epv.forEach((e, k) => {
    e.forEach((v, p) => {
      if (p !== prop) return
      if (typeof v === "function") v = v() //observable
      if (v === value) entities.push(k)
    })
  })
  return entities
}

const patchEpv = (store, patch) => {
  const pvePatch = []
  forEach(patch, (ePatch, e) => {
    let m1 = store.get(e)
    if (!m1) {
      m1 = new Map()
      store.set(e, m1)
    }
    forEach(ePatch, (pPatch, p) => {
      const v2 = m1.get(p)
      let currentValue
      if (isObservable(v2)) {
        currentValue = v2()
        v2(pPatch) // si la valeur est observée, on stocke excplicitement null car on ne peut pas supprimer l'observable
      } else {
        currentValue = v2
        if (pPatch == null) {
          m1.delete(p)
        } else {
          m1.set(p, pPatch)
        }
      }
      if (currentValue != null) pvePatch.push([p, currentValue, e, false])
      if (pPatch != null) pvePatch.push([p, pPatch, e, true])
    })
    if (m1.size === 0) store.delete(e)
  })
  return pvePatch
}

// ceci n'est pas la source de vérité, ce n'est qu'un index, donc on n'y stocke que des observables actifs que l'on mute en fonction du patch
const patchPve = (store, patch) => {
  forEach(patch, ([p, v, e, add]) => {
    let pMap = store.get(p)
    if (!pMap) return
    const obs = pMap.get(v)
    if (!obs) return
    const entities = obs()
    if (add) {
      entities.push(e)
    } else {
      entities.splice(entities.indexOf(e), 1)
    }
    obs(entities)
  })
}

// epv doit être un map de maps de valeurs serialisables en JSON
module.exports = epv => {
  if (!epv) epv = new Map()
  // crée un observable de v de façon lazy ainsi que la structure intermédiaire si besoin
  const getFromEpv = (e, p) => {
    let eMap = epv.get(e)
    if (!eMap) {
      eMap = new Map()
      epv.set(e, eMap)
    }
    let pValue = eMap.get(p)
    if (!isObservable(pValue)) {
      pValue = observable(pValue != null ? pValue : null, `epv::${e}::${p}`)
      eMap.set(p, pValue)
    }
    return pValue()
  }
  // crée un observable de e de façon lazy ainsi que la structure intermédiaire si besoin
  const pve = new Map()
  const getFromPve = (p, v) => {
    let pMap = pve.get(p)
    if (!pMap) {
      pMap = new Map()
      pve.set(p, pMap)
    }
    let e = pMap.get(v)
    if (!e) {
      const eValue = getEntitiesFrom(epv, p, v)
      e = observable(eValue, `pve::${p}::${v}`)
      pMap.set(v, e)
    }
    return e()
  }

  return {
    getFromEpv,
    getFromPve,
    patch: patch =>
      transaction(() => {
        const pvePatch = patchEpv(epv, patch)
        patchPve(pve, pvePatch)
      }),
  }
}
