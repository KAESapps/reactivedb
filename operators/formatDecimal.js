const get = require("lodash/get")

module.exports = opt => n => {
  const digits = opt || 3
  if (!get(n, "toLocaleString") || isNaN(n)) return "?"
  return n.toLocaleString("fr", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })
}
