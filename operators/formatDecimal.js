const get = require("lodash/get")
const isInteger = require("lodash/isInteger")

module.exports = (opts) => (n) => {
  if (opts == null) {
    opts = { fractionDigits: 3 }
  } else if (isInteger(opts)) {
    opts = { fractionDigits: opts }
  }
  if (!get(n, "toLocaleString") || isNaN(n)) return ""
  return n
    .toLocaleString(
      "fr",
      opts.fractionDigits == null
        ? // si fractionDigits non défini, on limite l'affichage à 6 pour éviter les débordements
          { maximumFractionDigits: 6 }
        : {
            maximumFractionDigits: opts.fractionDigits,
            minimumFractionDigits: opts.fractionDigits,
          }
    )
    .replace(/\u202f/g, "\xa0") // parce que le "narrow non breaking space" ne s'affiche pas bien dans pdfmake
}
