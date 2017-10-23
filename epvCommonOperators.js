const get = require("lodash/get")
const sortBy = require("lodash/sortBy")
const some = require("lodash/some")
const every = require("lodash/every")
const uniq = require("lodash/uniq")
const filter = require("lodash/filter")
const groupBy = require("lodash/groupBy")
const pickBy = require("lodash/pickBy")
const find = require("lodash/find")
const map = require("lodash/map")
const mapValues = require("lodash/mapValues")
const reverse = require("lodash/reverse")
const difference = require("lodash/difference")
const last = require("lodash/last")
const first = arr => (arr ? arr[0] : null)
const flatten = require("lodash/flatten")
const take = require("lodash/take")
const sum = require("lodash/sum")
const log = fn => fn
// const log = (fn, name) => (arg1, arg2) => {
//   const timeName = `computing ${name}: ${arg1}, ${arg2}`
//   console.time(timeName)
//   const res = fn(arg1, arg2)
//   console.timeEnd(timeName)
//   return res
// }

module.exports = store => {
  const operators = {
    patchToRemoveAllPropsOf: id => ({
      [id]: store.createPatchToRemoveAllPropsOf(id),
    }),
    entitiesMatching: filter => {
      const filterKeys = Object.keys(filter)
      if (filterKeys.length === 1) {
        // optimise le cas avec une seule prop par égalité
        const prop = filterKeys[0]
        const value = filter[prop]
        if (typeof value !== "object") return store.getFromPve(prop, value)
      }
      return store.getEntitiesMatching(filter)
    },
    findEntityMatching: filter =>
      operators.query([{ entitiesMatching: filter }, "first"]), // à remplacer par un appel à entitiesByValueOfProps
    entitiesWithValue: log(
      (prop, value) => store.getFromPve(prop, value),
      "entitiesWithValue"
    ),
    entityWithValue: (prop, value) => last(store.getFromPve(prop, value)),
    entitiesWithProp: log(
      (value, prop) => store.getFromPve(prop, value),
      "entitiesWithProp"
    ),
    entityWithProp: (value, prop) => last(store.getFromPve(prop, value)),
    valueOfProp: (id, prop) => store.getFromEpv(id, prop),
    entitiesByValueOf: prop => store.getFromP_ve(prop),
    //TODO: créer un index "entitesByValueOfProps" qui permet d'indexer avec plusieurs props au lieu d'une seule comme dans "entitesByValueOf"
    entitiesAndValueOfProp: prop => store.getFromP_ev(prop),
    getFromGroupBy: (groupBy, value) => get(groupBy, value, []),
    constant: (v1, v2) => (v2 != null ? v2 : v1), // dans le cas où il y a une source, constant est appelé avec 2 args mais c'est le 2ème qui compte
    first,
    last,
    flatten,
    sum,
    take,
    count: arr => arr.length,
    ObjectKeys: o => Object.keys(o),
    reverse,
    not: v => !v,
    some,
    every,
    unique: uniq,
    concat: (v1, v2) => (Array.isArray(v1) ? v1.concat(v2) : v1 + v2),
    join: (strings, sep) => strings.join(sep),
    isDefined: v => v != null,
    default: (value, defaultValue) => (value == null ? defaultValue : value),
    groupBy: (arr, exp) => {
      return groupBy(arr, v => {
        return operators.query([{ constant: v }].concat(exp))
      })
    },
    filterBy: (arr, exp) => {
      return filter(arr, v => {
        return operators.query([{ constant: v }].concat(exp))
      })
    },
    filterObjectBy: (obj, exp) => {
      return pickBy(obj, v => {
        return operators.query([{ constant: v }].concat(exp))
      })
    },
    rejectBy: (arr, exp) => {
      return filter(arr, v => {
        return !operators.query([{ constant: v }].concat(exp))
      })
    },
    findBy: (arr, exp) => {
      return find(arr, v => {
        return operators.query([{ constant: v }].concat(exp))
      })
    },
    sortBy: (ids, exp) =>
      sortBy(ids, id => operators.query([{ constant: id }].concat(exp))),
    someBy: (ids, exp) =>
      some(ids, id => operators.query([{ constant: id }].concat(exp))),
    mapBy: (ids, exp) =>
      map(ids, id => operators.query([{ constant: id }].concat(exp))),
    mapObjectBy: (obj, exp) =>
      mapValues(obj, id => operators.query([{ constant: id }].concat(exp))),
    each: (v, exps) => {
      let mapExp
      if (!exps) {
        exps = v
        mapExp = exp => operators.query(exp)
      } else {
        mapExp = exp => operators.query([{ constant: v }].concat(exp))
      }

      return (Array.isArray(exps) ? map : mapValues)(exps, mapExp)
    },
    gte: (arg1, arg2) => {
      const [v1, v2] = Array.isArray(arg1) ? arg1 : [arg1, arg2]
      return v1 >= v2
    },
    gt: (arg1, arg2) => {
      const [v1, v2] = Array.isArray(arg1) ? arg1 : [arg1, arg2]
      return v1 > v2
    },
    lte: (arg1, arg2) => {
      const [v1, v2] = Array.isArray(arg1) ? arg1 : [arg1, arg2]
      return v1 <= v2
    },
    lt: (arg1, arg2) => {
      const [v1, v2] = Array.isArray(arg1) ? arg1 : [arg1, arg2]
      return v1 < v2
    },
    equal: (arg1, arg2) => {
      const [v1, v2] = Array.isArray(arg1) ? arg1 : [arg1, arg2]
      return v1 === v2
    },
    append: (v, exp) => [v, operators.query(exp)],
    union: ([s1, s2]) => s1.concat(s2),
    difference: ([s1, s2]) => {
      return difference(s1, s2)
    },
    branch: (cond, cases) =>
      operators.query(
        (cond !== undefined ? [{ constant: cond }] : []).concat(
          cond ? cases["truthy"] : cases["falsy"]
        )
      ),
    formatInteger: n =>
      get(n, "toLocaleString")
        ? n.toLocaleString("fr", {
            maximumFractionDigits: 0,
          })
        : "?",
    formatNumber: (n, options) =>
      get(n, "toLocaleString") ? n.toLocaleString("fr", options) : "?",
    formatDate: (n, options) =>
      n ? new Date(n).toLocaleDateString("fr", options) : "?",
    formatTime: (n, options) =>
      n ? new Date(n).toLocaleTimeString("fr", options) : "?",
  }
  return operators
}
