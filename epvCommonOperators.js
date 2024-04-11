const env = process.env.NODE_ENV || "dev"
const log = require("./log")
const get = require("lodash/get")
const merge = require("lodash/merge")
const set = require("lodash/set")
const sortBy = require("lodash/sortBy")
const orderBy = require("lodash/orderBy")
const some = require("lodash/some")
const every = require("lodash/every")
const uniq = require("lodash/uniq")
const uniqBy = require("lodash/uniqBy")
const includes = require("lodash/includes")
const filter = require("lodash/filter")
const compact = require("lodash/compact")
const groupBy = require("lodash/groupBy")
const pickBy = require("lodash/pickBy")
const find = require("lodash/find")
const map = require("lodash/map")
const concat = require("lodash/concat")
const split = require("lodash/split")
const join = require("lodash/join")
const mapValues = require("lodash/mapValues")
const mapKeys = require("lodash/mapKeys")
const reverse = require("lodash/reverse")
const difference = require("lodash/difference")
const intersection = require("lodash/intersection")
const last = require("lodash/last")
const first = (arr) => (arr ? arr[0] : null)
const startsWith = require("lodash/startsWith")
const flatten = require("lodash/flatten")
const flattenDeep = require("lodash/flattenDeep")
const take = require("lodash/take")
const drop = require("lodash/drop")
const takeRight = require("lodash/takeRight")
const sum = require("lodash/sum")
const mean = require("lodash/mean")
const min = require("lodash/min")
const max = require("lodash/max")
const round = require("lodash/round")
const floor = require("lodash/floor")
const ceil = require("lodash/ceil")
const zipObject = require("lodash/zipObject")
const fromPairs = require("lodash/fromPairs")
const updateWith = require("lodash/updateWith")
const toNumber = require("lodash/toNumber")
const padStart = require("lodash/padStart")
const matchSorter = require("match-sorter").default
const localeIndexOf = require("locale-index-of")(Intl)
const formatISO = require("date-fns/formatISO")
const getISOWeek = require("date-fns/getISOWeek")
const getISOWeekYear = require("date-fns/getISOWeekYear")
const cartesian = require("cartesian")
const obsMemoize = require("./obsMemoize")
const formatInteger = require("./operators/formatInteger")
const formatDecimal = require("./operators/formatDecimal")
const formatCurrency = require("./operators/formatCurrency")
const formatDate = require("./operators/formatDate")
const formatDateTime = require("./operators/formatDateTime")
const ANY = "$any$"

const logComputed =
  env === "dev"
    ? (fn, name) => (arg1, arg2) => {
        const timeName = `computing ${name}: ${arg1}, ${arg2}`
        console.time(timeName)
        const res = fn(arg1, arg2)
        console.timeEnd(timeName)
        return res
      }
    : (fn) => fn

module.exports = (store) => {
  const operators = {
    getPvOf: (id) => store.getFromE_pv(id), // à usage interne/spécifique seulement
    forEachTriplet: (cb) => store.forEachTriplet(cb), // à usage interne/spécifique seulement
    patchToRemoveAllPropsOf: (id) =>
      id
        ? {
            [id]: store.createPatchToRemoveAllPropsOf(id),
          }
        : {},
    entityRemovePatch: (entityId) =>
      store.createPatchToRemoveAllPropsOf(entityId),
    entitiesRemovePatch: (ids) =>
      fromPairs(map(ids, (id) => [id, operators.entityRemovePatch(id)])),
    entitiesMatching: function (arg1, arg2) {
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
    findEntityMatching: (filter) => first(operators.entitiesMatching(filter)), // à remplacer par un appel à entitiesByValueOfProps
    entitiesWithValue: (prop, value) => store.getFromPve(prop, value),
    entityWithValue: (prop, value) => last(store.getFromPve(prop, value)),
    entitiesWithProp: (value, prop) => store.getFromPve(prop, value),
    entityWithProp: (value, prop) => last(store.getFromPve(prop, value)),
    valueOfProp: (id, prop) => store.getFromEpv(id, prop),
    entitiesByValueOf: (prop) => store.getFromP_ve(prop),
    //TODO: créer un index "entitesByValueOfProps" qui permet d'indexer avec plusieurs props au lieu d'une seule comme dans "entitesByValueOf"
    entitiesAndValueOfProp: (prop) => store.getFromP_ev(prop),
    getFromGroupBy: (groupBy, value) => get(groupBy, value, []),
    constant: function (v1, v2) {
      return arguments.length === 2 ? v2 : v1
    }, // dans le cas où il y a une source, constant est appelé avec 2 args mais c'est le 2ème qui compte
    typeof: (v) => typeof v,
    get: (v, prop) => get(v, prop),
    first,
    last,
    flatten,
    flattenDeep,
    sum: (arg) => {
      return sum(compact(arg))
    },
    mean,
    min,
    max,
    compact,
    plus: (v, exp) => v + operators.query(exp),
    minus: (v, exp) => (exp ? v - operators.query(exp) : v[0] - v[1]),
    divide: (v, exp) => (exp ? v / operators.query(exp) : v[0] / v[1]),
    multiply: (v, exp) => {
      if (!exp && Array.isArray(v)) {
        return v.reduce((a, b) => a * b)
      }
      return v * operators.query(exp)
    },
    modulo: (v, m) => v % m,
    take: (v, n) => (typeof v === "string" ? v.slice(0, n) : take(v, n)),
    takeEnd: (v, n) =>
      typeof v === "string" ? v.slice(n * -1) : takeRight(v, n),
    drop,
    count: (arr) => arr.length,
    contains: (arr, exp) => includes(arr, operators.query(exp)),
    containedIn: (v, arr) => includes(arr, v),
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
    ObjectKeys: (o) => Object.keys(o),
    reverse: (arr) => reverse(arr.slice()),
    toBoolean: (v) => !!v,
    not: (v) => !v,
    identity: (v) => v,
    some,
    every,
    unique: uniq,
    uniqueBy: (arr, exp) =>
      uniqBy(arr, (v) => operators.query(concat({ constant: v }, exp))),
    round,
    roundMultiple: (v, precision) => round(v / precision) * precision,
    floor,
    floorMultiple: (v, precision) => floor(v / precision) * precision,
    roundDown: floor,
    ceil,
    ceilMultiple: (v, precision) => ceil(v / precision) * precision,
    roundUp: ceil,
    padStart: (s, arg) => {
      if (typeof arg === "number") return padStart(s, arg)
      return padStart(s, arg.length, arg.chars)
    },
    zipObject: (args) => zipObject(args[0], args[1]),
    fromPairs,
    concat: (v1, v2) => (Array.isArray(v1) ? v1.concat(v2) : v1 + v2),
    concatExp: (v1, exp) =>
      Array.isArray(v1)
        ? v1.concat(operators.query(exp))
        : v1 + operators.query(exp),
    split: (string, sep) => split(string, sep),
    join: (strings, sep) => join(strings, sep),
    isDefined: (v) => v != null,
    isEmpty: (v) => (Array.isArray(v) ? v.length === 0 : v == null),
    default: (value, defaultValue) => (value == null ? defaultValue : value),
    and: (value, exp) => value && operators.query(exp),
    andLazy: (value, exps) =>
      every(exps, (exp) => operators.query([{ constant: value }].concat(exp))),
    or: (v, exps) => {
      return some(exps, (exp) => operators.query([{ constant: v }].concat(exp)))
    },
    defaultExp: (value, exp) => (value != null ? value : operators.query(exp)),
    groupBy: (arr, exp) => {
      return groupBy(arr, (v) => {
        return operators.query([{ constant: v }].concat(exp))
      })
    },
    filterBy: (arr, exp) => {
      return filter(arr, (v) => {
        return operators.query([{ constant: v }].concat(exp))
      })
    },
    filterObjectBy: (obj, exp) => {
      return pickBy(obj, (v) => {
        return operators.query([{ constant: v }].concat(exp))
      })
    },
    rejectBy: (arr, exp) => {
      return filter(arr, (v) => {
        return !operators.query([{ constant: v }].concat(exp))
      })
    },
    findBy: (arr, exp) => {
      return find(arr, (v) => {
        return operators.query([{ constant: v }].concat(exp))
      })
    },
    sortBy: (ids, exp) =>
      sortBy(ids, (id) => operators.query([{ constant: id }].concat(exp))),
    orderBy: (ids, arg) => {
      const { mappers, orders } = arg
      return orderBy(
        ids,
        mappers.map(
          (exp) => (id) => operators.query([{ constant: id }].concat(exp))
        ),
        orders
      )
    },
    someBy: (ids, exp) =>
      some(ids, (id) => operators.query([{ constant: id }].concat(exp))),
    mapBy: (ids, exp) =>
      map(ids, (id) => operators.query([{ constant: id }].concat(exp))),
    // crée un objet avec les valeurs du array en key and value
    arrayToObject: (arr) => arr.reduce((acc, id) => set(acc, id, id), {}),
    mapObjectBy: (obj, exp) =>
      mapValues(obj, (id) => operators.query([{ constant: id }].concat(exp))),
    mapKeysBy: (obj, exp) =>
      mapKeys(obj, (id) => operators.query([{ constant: id }].concat(exp))),
    // assigne sur arg1 ou sur un objet vide, le ou les objets sources (soit un objet seul ou un array de sources)
    assign: (arg1, arg2) => {
      const target = arg2 ? arg1 : {}
      const sources = operators.query(arg2 ? arg2 : arg1)
      return Object.assign.apply(null, concat(target, sources))
    },
    merge: (sources) => merge({}, ...sources),
    each: (v, exps) => {
      let mapExp
      if (!exps) {
        exps = v
        mapExp = (exp) => operators.query(exp)
      } else {
        mapExp = (exp) => operators.query([{ constant: v }].concat(exp))
      }
      return (Array.isArray(exps) ? map : mapValues)(exps, mapExp)
    },
    // retourne le premier résultat non null
    // c'est comme un each mais qui retourne le premier résultat non null ...
    firstDefined: (v, exps) => {
      let mapExp
      if (!exps) {
        exps = v
        mapExp = (exp) => operators.query(exp)
      } else {
        mapExp = (exp) => operators.query([{ constant: v }].concat(exp))
      }
      for (var i = 0; i < exps.length; i++) {
        let res = mapExp(exps[i])
        if (res != null) return res
      }
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
    equalExp: (value, exp) => value === operators.query(exp),
    isTruthy: (v) => !!v,
    isFalsy: (v) => !v,
    startsWith: (arg1, arg2) => {
      return startsWith(arg1, arg2)
    },
    prepend: (v, exp) => [operators.query(exp), v],
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
    match: (value, args) => {
      if (value === undefined) {
        value = null
      }
      let branch = args[value]
      if (!branch) {
        branch = args["default"]
      }
      if (!branch) return value
      return operators.query([{ constant: value }].concat(branch))
    },
    matchBy: (value, { cond, cases }) => {
      if (value === undefined) {
        value = null
      }
      const condValue = operators.query(concat({ constant: value }, cond))
      let branch = cases[condValue]
      if (!branch) {
        branch = cases["default"]
      }
      if (!branch) return value
      return operators.query([{ constant: value }].concat(branch))
    },
    formatInteger,
    formatNumber: (n, options) =>
      get(n, "toLocaleString") ? n.toLocaleString("fr", options) : "",
    formatDate,
    formatDecimal: (n, decimals) => formatDecimal(decimals)(n),
    formatTime: (n, options) =>
      n ? new Date(n).toLocaleTimeString("fr", options) : "",
    formatDateTime,
    formatBoolean: (n) => (n ? "OUI" : "NON"),
    formatCurrency,
    toNumber,
    toDateTime: ([date, time]) => {
      if (!date || !date.concat || !time) return
      return date.concat("T", time)
    },
    isoDateTimeToDate: (isoDateTime) =>
      isoDateTime
        ? formatISO(new Date(isoDateTime), { representation: "date" })
        : null,
    isoDateTimeToWeek: (isoDateTime) => {
      if (!isoDateTime) return null
      const date = new Date(isoDateTime)
      return `${getISOWeekYear(date)}W${getISOWeek(date)}`
    },
    isoDateTimeToMonth: (isoDateTime) =>
      isoDateTime
        ? formatISO(new Date(isoDateTime), { representation: "date" }).slice(
            0,
            7
          )
        : null,
    isoDateTimeToYear: (isoDateTime) =>
      isoDateTime
        ? formatISO(new Date(isoDateTime), { representation: "date" }).slice(
            0,
            4
          )
        : null,
    stringify: JSON.stringify,
    jsonParse: (v) => {
      try {
        return JSON.parse(v)
      } catch (err) {
        log.warn("jsonParse operator error", { err })
        return null
      }
    },

    multiGroupBy: obsMemoize(
      // on inclue la définition de la source dans les arguments pour pouvoir
      // memoizer le résultat à partir de la définition de source et non de sa valeur
      (arg) => () => {
        const values = {}
        // console.time("multiGroupByData")
        const data = operators.query(arg.source)
        // console.timeEnd("multiGroupByData")

        // console.time("multiGroupBy combinaisons")
        data.forEach((item) => {
          const dimValues = arg.dims.map((dimExp) =>
            operators.query([{ constant: item }].concat(dimExp))
          )

          // toutes les combinaisons de dimensions, totaux compris
          const combinations = cartesian(dimValues.map((v) => [v, ANY]))

          combinations.forEach((path) => {
            // ajoute l'élément dans la liste croisée
            updateWith(
              values,
              path,
              (arr) => (arr ? arr.concat(item) : [item]),
              Object
            )
          })
        })
        // console.timeEnd("multiGroupBy combinaisons")

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
      "multiGroupBy"
    ),
    getGroupsFromMultiGroupBy: (data, path) => {
      const groups = path && path.length > 0 ? get(data, path) : data
      if (!groups) return []
      return Object.keys(groups).filter((k) => k !== ANY)
    },

    getValuesFromMultiGroupBy: (data, path) => {
      return get(data, path, [])
    },

    matchSorter: (source, arg) => {
      // keys est facultatif
      const { searchValue, mapBy, keys } = arg

      // map source items
      const items = source.map((item) => ({
        sourceItem: item,
        sortingValue: operators.query([{ constant: item }].concat(mapBy)),
      }))

      // sort items, and return sorted source items back
      return matchSorter(items, searchValue, {
        keys: keys
          ? keys.map((k) => (i) => i.sortingValue[k])
          : [(i) => i.sortingValue],
      }).map((i) => i.sourceItem)
    },
    toCsvCell: (v) => {
      if (v == null) return "" //null or undefined
      return JSON.stringify(v)
    },
    toCsvRow: (arr, options) =>
      arr.map(operators.toCsvCell).join((options && options.separator) || ","),
    toCsv: (arr, options) =>
      arr.map((r) => operators.toCsvRow(r, options)).join("\r\n"),
  }
  return operators
}
