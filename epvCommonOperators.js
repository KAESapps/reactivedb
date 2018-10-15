const get = require("lodash/get")
const set = require("lodash/set")
const sortBy = require("lodash/sortBy")
const some = require("lodash/some")
const every = require("lodash/every")
const uniq = require("lodash/uniq")
const uniqBy = require("lodash/uniqBy")
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
const startsWith = require("lodash/startsWith")
const flatten = require("lodash/flatten")
const take = require("lodash/take")
const drop = require("lodash/drop")
const takeEnd = require("lodash/takeRight")
const sum = require("lodash/sum")
const round = require("lodash/round")
const zipObject = require("lodash/zipObject")
const fromPairs = require("lodash/fromPairs")
const updateWith = require("lodash/updateWith")
const toNumber = require("lodash/toNumber")
const padStart = require("lodash/padStart")
const matchSorter = require("match-sorter")
const localeIndexOf = require("locale-index-of")(Intl)
const cartesian = require("cartesian")
const obsMemoize = require("./obsMemoize")
const formatInteger = require("./operators/formatInteger")
const formatDate = require("./operators/formatDate")
const formatDateTime = require("./operators/formatDateTime")
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
    entitiesMatching: function(arg1, arg2) {
      const filter = arguments.length === 2 ? arg2 : arg1

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
    typeof: v => typeof v,
    get: (v, prop) => get(v, prop),
    first,
    last,
    flatten,
    sum,
    plus: (v, exp) => v + operators.query(exp),
    minus: (v, exp) => v - operators.query(exp),
    divide: (v, exp) => v / operators.query(exp),
    multiply: (v, exp) => v * operators.query(exp),
    take: (v, n) => (typeof v === "string" ? v.slice(0, n) : take(v, n)),
    takeEnd,
    drop,
    count: arr => arr.length,
    contains: (arr, exp) => includes(arr, operators.query(exp)),
    localeInsensitiveIndexOf: (string, substring) => {
      if (
        !string ||
        !substring ||
        typeof string !== "string" ||
        typeof substring !== "string"
      )
        return -1
      return localeIndexOf(string, substring, "fr", { sensitivity: "base" })
    },
    localeInsensitiveContains: (string, substring) =>
      operators.localeInsensitiveIndexOf(string, substring) >= 0,
    ObjectKeys: o => Object.keys(o),
    reverse: arr => reverse(arr.slice()),
    toBoolean: v => !!v,
    not: v => !v,
    identity: v => v,
    some,
    every,
    unique: uniq,
    uniqueBy: (arr, exp) =>
      uniqBy(arr, v => operators.query(concat({ constant: v }, exp))),
    round,
    padStart: (s, arg) => {
      if (typeof arg === "number") return padStart(s, arg)
      return padStart(s, arg.length, arg.chars)
    },
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
    and: (value, exp) => value && operators.query(exp),
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
    isTruthy: v => !!v,
    isFalsy: v => !v,
    startsWith: (arg1, arg2) => {
      return startsWith(arg1, arg2)
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
    formatDateTime,
    formatBoolean: n => (n ? "OUI" : "NON"),
    formatCurrency: n =>
      get(n, "toLocaleString")
        ? n.toLocaleString("fr", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "?",

    toNumber,
    stringify: JSON.stringify,

    multiGroupBy: obsMemoize(
      // on inclue la définition de la source dans les arguments pour pouvoir
      // memoizer le résultat à partir de la définition de source et non de sa valeur
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

    matchSorter: (source, arg) => {
      // keys est facultatif
      const { searchValue, mapBy, keys } = arg

      // map source items
      const items = source.map(item => ({
        sourceItem: item,
        sortingValue: operators.query([{ constant: item }].concat(mapBy)),
      }))

      // sort items, and return sorted source items back
      return matchSorter(items, searchValue, {
        keys: keys
          ? keys.map(k => i => i.sortingValue[k])
          : [i => i.sortingValue],
      }).map(i => i.sourceItem)
    },
    toCsvCell: v => {
      if (typeof v === "string") return '"' + v + '"'
      if (typeof v === "boolean") return v ? "true" : "false"
      return v + ""
    },
    toCsvRow: arr => arr.map(operators.toCsvCell).join(","),
    toCsv: arr => arr.map(operators.toCsvRow).join("\r\n"),
  }
  return operators
}
