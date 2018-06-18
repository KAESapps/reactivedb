const get = require("lodash/get")
const set = require("lodash/set")
const sortBy = require("lodash/sortBy")
const some = require("lodash/some")
const every = require("lodash/every")
const uniq = require("lodash/uniq")
const includes = require("lodash/includes")
const filter = require("lodash/filter")
const groupBy = require("lodash/groupBy")
const pickBy = require("lodash/pickBy")
const find = require("lodash/find")
const map = require("lodash/map")
const concat = require("lodash/concat")
const mapValues = require("lodash/mapValues")
const reverse = require("lodash/reverse")
const difference = require("lodash/difference")
const intersection = require("lodash/intersection")
const last = require("lodash/last")
const first = arr => (arr ? arr[0] : null)
const flatten = require("lodash/flatten")
const take = require("lodash/take")
const takeEnd = require("lodash/takeRight")
const sum = require("lodash/sum")
const round = require("lodash/round")
const zipObject = require("lodash/zipObject")
const fromPairs = require("lodash/fromPairs")
const updateWith = require("lodash/updateWith")
const toNumber = require("lodash/toNumber")
const cartesian = require("cartesian")
const obsMemoize = require("./obsMemoize")
const formatInteger = require("./operators/formatInteger")
const formatDate = require("./operators/formatDate")
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
    entityRemovePatch: entityId =>
      store.createPatchToRemoveAllPropsOf(entityId),
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
    constant: function(v1, v2) {
      return arguments.length === 2 ? v2 : v1
    }, // dans le cas où il y a une source, constant est appelé avec 2 args mais c'est le 2ème qui compte
    first,
    last,
    flatten,
    sum,
    minus: (v, exp) => v - operators.query(exp),
    take: (v, n) => (typeof v === "string" ? v.slice(0, n) : take(v, n)),
    takeEnd,
    count: arr => arr.length,
    contains: (arr, exp) => includes(arr, operators.query(exp)),
    ObjectKeys: o => Object.keys(o),
    reverse: arr => reverse(arr.slice()),
    not: v => !v,
    identity: v => v,
    some,
    every,
    unique: uniq,
    round,
    zipObject: args => zipObject(args[0], args[1]),
    fromPairs,
    concat: (v1, v2) => (Array.isArray(v1) ? v1.concat(v2) : v1 + v2),
    concatExp: (v1, exp) =>
      Array.isArray(v1)
        ? v1.concat(operators.query(exp))
        : v1 + operators.query(exp),
    join: (strings, sep) => strings.join(sep),
    isDefined: v => v != null,
    default: (value, defaultValue) => (value == null ? defaultValue : value),
    defaultExp: (value, exp) => (value != null ? value : operators.query(exp)),
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
    // crée un objet avec les valeurs du array en key and value
    arrayToObject: arr => arr.reduce((acc, id) => set(acc, id, id), {}),
    mapObjectBy: (obj, exp) =>
      mapValues(obj, id => operators.query([{ constant: id }].concat(exp))),
    // assigne sur arg1 ou sur un objet vide, le ou les objets sources (soit un objet seul ou un array de sources)
    assign: (arg1, arg2) => {
      const target = arg2 ? arg1 : {}
      const sources = operators.query(arg2 ? arg2 : arg1)
      return Object.assign.apply(null, concat(target, sources))
    },
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
    intersection: ([s1, s2]) => intersection(s1, s2),
    branch: (value, args) => {
      if (value === undefined) {
        value = null
      }
      const cond = args.cond
        ? operators.query([{ constant: value }].concat(args.cond))
        : value
      const branch = cond ? args["truthy"] : args["falsy"]
      if (!branch) return value
      return operators.query([{ constant: value }].concat(branch))
    },
    formatInteger,
    formatNumber: (n, options) =>
      get(n, "toLocaleString") ? n.toLocaleString("fr", options) : "?",
    formatDate,
    formatTime: (n, options) =>
      n ? new Date(n).toLocaleTimeString("fr", options) : "?",
    formatDateTime: (n, options) =>
      n ? new Date(n).toLocaleString("fr", options) : "?",
    formatBoolean: n => (n ? "OUI" : "NON"),

    toNumber,

    multiGroupBy: obsMemoize(
      arg => () => {
        const ANY = "$any$"
        const values = {}
        operators.query(arg.source).forEach(item => {
          const dimValues = arg.dims.map(dimExp =>
            operators.query([{ constant: item }].concat(dimExp))
          )

          // toutes les combinaisons de dimensions, totaux compris
          const combinations = cartesian(dimValues.map(v => [v, ANY]))

          combinations.forEach(path => {
            // ajoute l'élément dans la liste croisée
            updateWith(
              values,
              path,
              arr => (arr ? arr.concat(item) : [item]),
              Object
            )
          })
        })

        return values
        /*
      return {
        // longueur 1200
        1200: {
          // lg 1200, essence idEss1
          idEss1: {
            // lg 1200, essence idEss1, qualité idQual1
            idQual1: [item1, item2],
            idQual2: [item5, item6],
            // lg 1200, essence idEss1, toute qualité
            $any$: [item1, item2, item5, item6],
          },
          idEss2: {
            idQual1: [item3, item4],
            $any$: [item3, item4]
          },
          // lg 1200, toute essence
          $any$: {
            // lg 1200, toute essence, qual1
            idQual1: [item1, item2, item3, item4],
            idQual2: [item5, item6],
            // lg 1200, toute essence, toute qualité
            $any$: [item1, item2, item3, item4, item5, item6]
          }
        },
        $any$: {
          ...
        },
      }
      */
      },
      "multiGroupBy",
      JSON.stringify
    ),
    getGroupsFromMultiGroupBy: (data, path) => {
      const groups = path.length > 0 ? get(data, path) : data
      if (!groups) return []
      return Object.keys(groups).filter(k => k !== "$any$")
    },

    getValuesFromMultiGroupBy: (data, path) => {
      return get(data, path, [])
    },
  }
  return operators
}
