const { transaction, Obs } = require("./obs") // on utilise Obs directement plutôt que observable car ça évite des closures inutiles, ça permet de bypasser le getter quand on n'a pas besoin de s'abonner à l'observable et de toute façon les observables ne sont pas exposés au public
const isObservable = o => o && o.get
const forEach = require("lodash/forEach")
const includes = require("lodash/includes")
const pull = require("lodash/pull")
const every = require("lodash/every")

const getEntitiesFrom = (epv, prop, value) => {
  const entities = []
  epv.forEach((e, k) => {
    e.forEach((v, p) => {
      if (p !== prop) return
      if (isObservable(v)) v = v.value //observable : on lit directement la valeur sans passer par le getter pour ne pas enregistrer de dépendance car c'est pour créer un observable sera mis à jour directement
      if (v === value) entities.push(k)
    })
  })
  return entities
}
const groupEntitiesByValueOfProp = (epv, prop) => {
  const group = {}
  epv.forEach((e, k) => {
    e.forEach((v, p) => {
      if (p !== prop) return
      if (isObservable(v)) v = v.value //observable
      let entities = group[v]
      if (!entities) {
        entities = [k]
        group[v] = entities
      } else {
        entities.push(k)
      }
    })
  })
  return group
}
const collectEntitiesAndValueOfProp = (epv, prop) => {
  const entities = {}
  epv.forEach((e, k) => {
    e.forEach((v, p) => {
      if (p !== prop) return
      if (isObservable(v)) v = v.value //observable
      entities[k] = v
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
        currentValue = v2.value
        if (pPatch === currentValue) return // pas de modif
        v2.set(pPatch) // si la valeur est observée, on stocke excplicitement null car on ne peut pas supprimer l'observable
      } else {
        currentValue = v2
        if (pPatch == null) {
          m1.delete(p)
        } else {
          if (pPatch === currentValue) return // pas de modif
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
const patchPve = (store, pvePatch) => {
  forEach(pvePatch, ([p, v, e, add]) => {
    let pMap = store.get(p)
    if (!pMap) return
    const obs = pMap.get(v)
    if (!obs) return
    const entities = obs.value
    const eIndex = entities.indexOf(e)
    if (add) {
      if (e >= 0) return console.log("entity already indexed", p, v, e)
      entities.push(e)
    } else {
      if (e < 0) return console.log("entity not indexed", p, v, e)
      entities.splice(eIndex, 1)
    }
    obs.set(entities)
  })
}

const patchGroupBy = (store, pvePatch) => {
  forEach(pvePatch, ([p, v, e, add]) => {
    let obs = store.get(p)
    if (!obs) return
    const group = obs.value
    let entities = group[v]
    if (add) {
      if (!entities) {
        entities = [e]
        group[v] = entities
      } else {
        entities.push(e)
      }
    } else {
      // remove
      if (entities.length === 1) {
        delete group[v]
      } else {
        entities.splice(entities.indexOf(e), 1)
      }
    }
    obs.set(group)
  })
}

const patchP_ev = (store, epvPatch) => {
  forEach(epvPatch, (ePatch, e) => {
    forEach(ePatch, (v, p) => {
      let obs = store.get(p)
      if (!obs) return
      const entities = obs.value
      if (entities[e] !== v) {
        // on ne modifie pas l'observable si pas de changement
        entities[e] = v
        obs.set(entities) // on déclenche la notification de la modif de l'observable
      }
    })
  })
}

const entitiesContains = includes
const entitiesRemove = pull
const entitiesAdd = (entities, e) => entities.push(e)
const match = (filter, pv) =>
  every(filter, (expectedValue, k) => {
    const v = pv.get(k)
    if (isObservable(v)) v = v.value
    return v === expectedValue
  })

const patchMatchingResults = (store, epvPatch, epv) => {
  store.forEach((matchingResult, serializedFilter) => {
    const entities = matchingResult.value
    let entitiesChanged = false
    const filter = JSON.parse(serializedFilter)
    forEach(epvPatch, (ePatch, e) => {
      const pv = epv.get(e)
      if (match(filter, pv)) {
        // si e est déjà dans les résultats, rien à faire, sinon...
        if (!entitiesContains(entities, e)) {
          entitiesAdd(entities, e)
          entitiesChanged = true
        }
      } else {
        // si e n'est pas dans les résultats, rien à faire, sinon...
        if (entitiesContains(entities, e)) {
          entitiesRemove(entities, e)
          entitiesChanged = true
        }
      }
    })
    if (entitiesChanged) matchingResult.set(entities) // notifiy observers
  })
}
const collectEntitiesMatching = (epv, filter) => {
  const data = []
  epv.forEach((pv, e) => {
    if (match(filter, pv)) data.push(e)
  })
  return data
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
      pValue = new Obs(
        pValue != null ? pValue : null,
        null,
        null,
        `epv::${e}::${p}`
      )
      eMap.set(p, pValue)
    }
    return pValue.get()
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
      e = new Obs(eValue, null, null, `pve::${p}::${v}`)
      pMap.set(v, e)
    }
    return e.get()
  }
  // crée un groupByValue de façon lazy pour une prop
  const p_ve = new Map()
  const getFromP_ve = p => {
    let group = p_ve.get(p)
    if (!group) {
      group = new Obs(
        groupEntitiesByValueOfProp(epv, p),
        null,
        null,
        `entitesByValueOf::${p}`
      )
      p_ve.set(p, group)
    }
    return group.get()
  }
  // crée à la demande un observable par propriété contenant un objet ev
  const p_ev = new Map()
  const getFromP_ev = p => {
    let group = p_ev.get(p)
    if (!group) {
      group = new Obs(
        collectEntitiesAndValueOfProp(epv, p),
        null,
        null,
        `entitesWithValueFor::${p}`
      )
      p_ev.set(p, group)
    }
    return group.get()
  }

  // crée une liste d'entités de façon lazy positives à un filtre
  const matchingResults = new Map()
  const getEntitiesMatching = filter => {
    const serializedFilter = JSON.stringify(filter)
    let result = matchingResults.get(serializedFilter)
    if (!result) {
      result = new Obs(
        collectEntitiesMatching(epv, filter),
        null,
        null,
        `entitesMatching::${serializedFilter}`
      )
      matchingResults.set(serializedFilter, result)
    }
    return result.get()
  }

  return {
    getFromEpv,
    getFromPve,
    getFromP_ve,
    getFromP_ev,
    getEntitiesMatching,
    patch: patch =>
      transaction(() => {
        // const timeLabel = "patchPve"
        // console.log(timeLabel)
        // console.time(timeLabel)
        const pvePatch = patchEpv(epv, patch)
        patchP_ev(p_ev, patch)
        patchPve(pve, pvePatch)
        patchGroupBy(p_ve, pvePatch)
        patchMatchingResults(matchingResults, patch, epv) //le patch doit déjà être appliqué sur epv avant de lancer ce traitement
        // console.timeEnd(timeLabel)
      }),
  }
}
