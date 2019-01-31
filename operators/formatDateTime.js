const isString = require("lodash/isString")
const assign = require("lodash/assign")
const datePrecisionAtLeast = require("./utils/datePrecision").atLeast

// prend une date ou datetime en ISO string
// et le formate en date avec heure

module.exports = (n, options = {}) => {
  if (options.precision) {
    const precisionAtLeast = datePrecisionAtLeast(options.precision)
    options = assign(
      {
        year: "numeric",
        month: precisionAtLeast("month") ? "numeric" : undefined,
        day: precisionAtLeast("day") ? "numeric" : undefined,
        hour: precisionAtLeast("hour") ? "numeric" : undefined,
        minute: precisionAtLeast("minute") ? "numeric" : undefined,
      },
      options
    )
  }
  if (!n || !isString(n)) return

  return new Date(n).toLocaleString(
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
