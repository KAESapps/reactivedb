const format = require("date-fns/format").default || require("date-fns/format")
const parseISO =
  require("date-fns/parseISO").default || require("date-fns/parseISO")
const isString = require("lodash/isString")
const assign = require("lodash/assign")
const datePrecisionAtLeast = require("./utils/datePrecision").atLeast

// prend une date ou datetime en ISO string
// et le formate en date avec heure

module.exports = (n, options = {}) => {
  if (!n || !isString(n)) return ""

  if (options.precision) {
    if (options.precision === "week") {
      // traitement à part pour la précision semaine
      return format(parseISO(n), "'S'II-RRRR")
    } else {
      const precisionAtLeast = datePrecisionAtLeast(options.precision)
      options = assign(
        {
          year: "numeric",
          month: precisionAtLeast("month") ? "numeric" : undefined,
          day: precisionAtLeast("day") ? "numeric" : undefined,
          hour: precisionAtLeast("hour") ? "numeric" : undefined,
          minute: precisionAtLeast("minute") ? "numeric" : undefined,
          second: precisionAtLeast("second") ? "numeric" : undefined,
        },
        options
      )
    }
  }
  const d = new Date(n)
  if (isNaN(d)) return "" //invalid date
  return d.toLocaleString(
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
