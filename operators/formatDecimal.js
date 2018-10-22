const get = require("lodash/get")

module.exports = opt => n => {
  const digits = opt || 3
  return get(n, "toLocaleString")
    ? n.toLocaleString("fr", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      })
    : "?"
}
