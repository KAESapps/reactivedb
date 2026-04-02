const every = require("lodash/every")
const includes = require("lodash/includes")
const isObjectLike = require("lodash/isObjectLike")
const toString = require("lodash/toString")
const toSimpleAscii = require("../toSimpleAscii")
//utilitaire pour savoir si une suite de conditions déclaratives "nommées"(keyed) est respectée
// ex: matchBy({nom: "toto", age:{get:20}}, k => get(object, k))

module.exports = (conds, by) =>
  every(conds, (propFilter, k) => {
    let v = by(k)

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
        if (op === "includes") {
          return includes(v, opValue)
        }
        if (op === "oneOf") {
          return includes(opValue, v)
        }
        if (op === "toString") {
          return toString(v) === opValue
        }
        if (op === "toSimpleAscii") {
          return toSimpleAscii(v) === opValue // c'est à l'utilisateur de fournir opValue en simpleAscii (comme pour les autres op)
        }
      })
    } else {
      return v === propFilter
    }
  })
