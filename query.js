const log = require("./log").sub("query")
var firstKey = (o) => (o ? Object.keys(o)[0] : null)

module.exports = (operators) => {
  operators.query = (query) => {
    let source, operation
    if (Array.isArray(query)) {
      source = query.slice()
      operation = source.pop()
    } else {
      operation = query
    }
    var operator =
      typeof operation === "string" ? operation : firstKey(operation)
    if (!operator || !operators[operator]) {
      log.error("opérateur inconnu", { operator, query, operation })
      return null // TODO: est-ce une bonne idée de ne pas planter ?
    }
    const arg = typeof operation === "object" ? operation[operator] : undefined

    let sourceRes
    if (source && source.length) {
      sourceRes = operators.query(source)
    }
    const start = performance.now()
    const res =
      source && source.length
        ? operators[operator](sourceRes, arg)
        : operators[operator](arg)
    const end = performance.now()
    const duration = end - start
    if (duration > 1000 * 10) {
      log.warn("long query", {
        seconds: Math.round(duration / 1000),
        query,
      })
    }
    return res
  }
  return operators.query
}
