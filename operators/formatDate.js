const isString = require("lodash/isString")
const defaults = require("lodash/defaults")
const assign = require("lodash/assign")
// prend une date ou datetime en ISO string
// et le formate en date sans heure

module.exports = (n, options) => {
  if (!n || !isString(n)) return

  return new Date(n).toLocaleDateString(
    "fr",
    assign(
      // fuseau horaire de Paris par défaut
      { timeZone: "Europe/Paris" },
      options,
      // force le timezone UTC s'il n'y a pas d'information d'heure, pour éviter les décalages horaires
      n.length <= 10 && { timeZone: "UTC" }
    )
  )
}
