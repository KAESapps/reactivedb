const get = require("lodash/get")

module.exports = (opt) => (n) => {
  const digits = opt != null ? opt : 3
  if (!get(n, "toLocaleString") || isNaN(n)) return ""
  return n
    .toLocaleString("fr", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    })
    .replace(/\u202f/g, "\xa0") // parce que le "narrow non breaking space" ne s'affiche pas bien dans pdfmake
}
