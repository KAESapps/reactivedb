const log = require("./log").sub("query")
var firstKey = (o) => Object.keys(o)[0]

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
    var arg
    if (typeof operation === "object") arg = operation[operator]

    if (!operators[operator]) {
      log.error("opérateur inconnu", { operator, query, operation })
      return null // TODO: est-ce une bonne idée de ne pas planter ?
    }

    return source && source.length
      ? operators[operator](operators.query(source), arg)
      : operators[operator](arg)
  }
  return operators.query
}
