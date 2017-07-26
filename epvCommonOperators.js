const get = require("lodash/get")
const sortBy = require("lodash/sortBy")
const some = require("lodash/some")
const filter = require("lodash/filter")
const find = require("lodash/find")
const map = require("lodash/map")
const reverse = require("lodash/reverse")
const difference = require("lodash/difference")
const last = require("lodash/last")
const first = arr => arr && arr[0]
const flatten = require("lodash/flatten")
const sum = require("lodash/sum")
const log = (fn, name) => (arg1, arg2) => {
  const timeName = `computing ${name}: ${arg1}, ${arg2}`
  console.time(timeName)
  const res = fn(arg1, arg2)
  console.timeEnd(timeName)
  return res
}

module.exports = store => {
  const operators = {
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
    entitiesByValueOf: prop => store.getGroupBy(prop),
    getFromGroupBy: (groupBy, value) => get(groupBy, value, []),
    constant: (v1, v2) => (v2 != null ? v2 : v1), // dans le cas où il y a une source, constant est appelé avec 2 args mais c'est le 2ème qui compte
    first,
    last,
    flatten,
    sum,
    count: arr => arr.length,
    reverse,
    some,
    isDefined: v => v != null,
    default: (value, defaultValue) => (value == null ? defaultValue : value),
    filterBy: (arr, exp) => {
      return filter(arr, v => {
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
    each: (v, exps) =>
      map(exps, exp => operators.query([{ constant: v }].concat(exp))),
    gte: ([v1, v2]) => {
      return v1 >= v2
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
      n && n.toLocaleString
        ? n.toLocaleString("fr", {
            maximumFractionDigits: 0,
          })
        : "?",
    formatNumber: (n, options) =>
      n && n.toLocaleString ? n.toLocaleString("fr", options) : "?",
    formatDate: (n, options) =>
      n ? new Date(n).toLocaleDateString("fr", options) : "?",
  }
  return operators
}
