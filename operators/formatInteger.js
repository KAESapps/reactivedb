const get = require("lodash/get")

module.exports = n =>
  get(n, "toLocaleString")
    ? n
        .toLocaleString("fr", {
          maximumFractionDigits: 0,
        })
        .replace(/\u202f/g, "\xa0") // parce que le "narrow non breaking space" ne s'affiche pas bien dans pdfmake
    : "?"
