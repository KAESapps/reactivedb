const { transaction, Obs } = require("kobs") // on utilise Obs directement plutôt que observable car ça évite des closures inutiles, ça permet de bypasser le getter quand on n'a pas besoin de s'abonner à l'observable et de toute façon les observables ne sont pas exposés au public
const isObservable = o => o && o.get
const forEach = require("lodash/forEach")
const includes = require("lodash/includes")
const pull = require("lodash/pull")
const every = require("lodash/every")
const assign = require("lodash/assign")
const concat = require("lodash/concat")
const isUndefined = require("lodash/isUndefined")
const isObjectLike = require("lodash/isObjectLike")
const update = require("lodash/update")
const without = require("lodash/without")

const addToArray = v => a => {
  if (a) {
    a.push(v)
    return a
  } else {
    return [v]
  }
}

// crée un index (map) avec un observable des entités par valeur existante de "prop"
const getObservablesOfEntitiesGroupedByValue = (epv, prop) => {
  const timeLabel = `createIndexOfEntitites for prop ${prop}`
  console.time(timeLabel)

  const pMap = new Map()
  epv.forEach((e, k) => {
    let v = e.get(prop)
    if (v == null) return
    if (isObservable(v)) v = v.value //observable
    if (v == null) return
    let entitiesObs = pMap.get(v)
    if (!entitiesObs) {
      entitiesObs = new Obs([k], null, null, `pve::${prop}::${v}`)
      pMap.set(v, entitiesObs)
    } else {
      entitiesObs.value.push(k)
    }
  })

  console.timeEnd(timeLabel)
  return pMap
}

const groupEntitiesByValueOfProp = (epv, prop) => {
  const group = {}
  epv.forEach((e, k) => {
    let v = e.get(prop)
    if (v == null) return
    if (isObservable(v)) v = v.value //observable
    if (v == null) return
    let entities = group[v]
    if (!entities) {
      entities = [k]
      group[v] = entities
    } else {
      entities.push(k)
    }
  })
  return group
}
const collectEntitiesAndValueOfProp = (epv, prop) => {
  const entities = {}
  epv.forEach((e, k) => {
    let v = e.get(prop)
    if (v == null) return
    if (isObservable(v)) v = v.value //observable
    if (v == null) return
    entities[k] = v
  })
  return entities
}

const patchEpv = (store, patch) => {
  const pvePatch = {}
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
      // la propriété (de l'entité) n'a plus la valeur "currentValue"
      if (currentValue != null)
        update(pvePatch, [p, currentValue, "remove"], addToArray(e))
      // la propriété passe à la valeur "pPatch"
      if (pPatch != null) update(pvePatch, [p, pPatch, "remove"], addToArray(e))
    })
    if (m1.size === 0) store.delete(e)
  })
  return pvePatch
}

// ceci n'est pas la source de vérité, ce n'est qu'un index, donc on n'y stocke que des observables actifs que l'on mute en fonction du patch
const patchPve = (store, pvePatch) => {
  //console.time("patchPve")
  forEach(pvePatch, (ve, p) => {
    let pMap = store.get(p)
    if (!pMap) return
    forEach(ve, (addRemove, v) => {
      const { add: eListAdd, remove: eListRemove } = addRemove
      const obs = pMap.get(v)

      if (eListAdd) {
        // ajout dans l'index sur la nouvelle valeur
        if (obs) {
          const entities = obs.value
          obs.set(entities.concat(eListAdd))
        } else {
          pMap.set(v, new Obs(eListAdd, null, null, `pve::${p}::${v}`))
          return
        }
      }

      if (eListRemove) {
        // suppression de l'index sur l'ancienne valeur
        const entities = obs.value
        obs.set(without.apply(null, [entities].concat(eListRemove)))
      }
    })
  })
  //console.timeEnd("patchPve")
}

// TODO: à rendre non-mutable ?
const patchGroupBy = (store, pvePatch) => {
  // console.time("patchGroupBy")

  forEach(pvePatch, (ve, p) => {
    let obs = store.get(p)
    if (!obs) return
    const pGroup = obs.value
    forEach(ve, (addRemove, v) => {
      const { add: eListAdd, remove: eListRemove } = addRemove

      const entities = pGroup[v]
      if (eListAdd) {
        // ajout dans l'index sur la nouvelle valeur
        pGroup[v] = concat(entities, eListAdd)
      }

      if (eListRemove) {
        // suppression de l'index sur l'ancienne valeur
        pGroup[v] = without.apply(null, [entities].concat(eListRemove))
      }
    })
    obs.set(pGroup)
  })

  // console.timeEnd("patchGroupBy")
}

const patchP_ev = (store, epvPatch) => {
  forEach(epvPatch, (ePatch, e) => {
    forEach(ePatch, (v, p) => {
      let obs = store.get(p)
      if (!obs) return
      const entities = obs.value
      // on ne modifie pas l'observable si pas de changement
      if (entities[e] !== v) {
        entities[e] = v
        // on déclenche la modif de l'observable avec un clone du résultat
        obs.set(assign({}, entities))
      }
    })
  })
}

const entitiesContains = includes
const entitiesRemove = pull
const entitiesAdd = (entities, e) => entities.push(e)
const match = (filter, pv) =>
  every(filter, (propFilter, k) => {
    let v = pv && pv.get(k) // pv peut être undefined dans le cas où le patch a supprimé toutes mes props de e
    if (isObservable(v)) v = v.value
    // treating undefined values as null
    if (isUndefined(v)) {
      v = null
    }

    if (isObjectLike(propFilter)) {
      return every(propFilter, (opValue, op) => {
        if (op === "eq") {
          return v === opValue
        }
        if (op === "ne") {
          return v !== opValue
        }
        if (op === "gt") {
          return v > opValue
        }
        if (op === "gte") {
          return v >= opValue
        }
        if (op === "lt") {
          return v < opValue
        }
        if (op === "lte") {
          return v <= opValue
        }
      })
    } else {
      return v === propFilter
    }
  })

// teste si le patch peut avoir un impact sur le résultat du filtre
const quickMatch = (filter, patch) => Object.keys(filter).some(k => k in patch)

const patchMatchingResults = (store, epvPatch, epv) => {
  store.forEach((matchingResult, serializedFilter) => {
    const entities = matchingResult.value
    let entitiesChanged = false
    const filter = JSON.parse(serializedFilter)
    forEach(epvPatch, (ePatch, e) => {
      if (!quickMatch(filter, ePatch)) return
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
    if (entitiesChanged) matchingResult.set(entities.slice()) // notify observers with clone
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
  // retourne une liste non réactive des props d'une entité (pour le besoin de générer un patch pour la supprimer)
  const createPatchToRemoveAllPropsOf = e => {
    const ret = {}
    let eMap = epv.get(e)
    if (!eMap) return ret
    eMap.forEach((v, k) => {
      if (isObservable(v)) v = v.value
      if (v != null) ret[k] = null
    })
    return ret
  }

  // pour chaque p, crée un map d'observables de v -> [e]
  const pve = new Map()
  const getFromPve = (p, v) => {
    let pMap = pve.get(p)
    if (!pMap) {
      pMap = getObservablesOfEntitiesGroupedByValue(epv, p) // scan la base une seule fois pour toutes les valeurs de p (au lieu de la faire à chaque demande d'une nouvelle valeur comme avant)
      pve.set(p, pMap)
    }
    let e = pMap.get(v)
    if (!e) {
      // s'il n'y a pas d'observable pour la valeur demandée, c'est qu'il n'y a pas (encore) de triplet avec cette valeur, donc, là, on crée de façon lazy un observable avec un array vide
      e = new Obs([], null, null, `pve::${p}::${v}`)
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

  const backup = () => {
    const data = {}
    epv.forEach((pv, e) => {
      const itemData = {}
      pv.forEach((v, p) => {
        itemData[p] = isObservable(v) ? v.value : v
      })
      data[e] = itemData
    })
    return data
  }

  return {
    data: epv,
    backup,
    createPatchToRemoveAllPropsOf,
    getFromEpv,
    getFromPve,
    getFromP_ve,
    getFromP_ev,
    getEntitiesMatching,
    patch: patch => {
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
      })
      return patch
    },
  }
}
