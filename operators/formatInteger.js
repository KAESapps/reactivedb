const get = require("lodash/get")

module.exports = n =>
  get(n, "toLocaleString")
    ? n.toLocaleString("fr", {
        maximumFractionDigits: 0,
      })
    : "?"
