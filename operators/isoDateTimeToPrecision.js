/* Permet de convertir une date à la précision voulue au format ISO
Accepte en argument une instance de date ou une chaine ISO (en fait un argument de new Date)
*/
const formatISO = require("date-fns/formatISO")
const getISOWeekYear = require("date-fns/getISOWeekYear")
const getISOWeek = require("date-fns/getISOWeek")

module.exports = (precision) => (arg) => {
  if (!arg) return null
  const date = new Date(arg)
  //TODO: if not isValid date return null
  if (precision === "date") return formatISO(date, { representation: "date" })
  if (precision === "week") return `${getISOWeekYear(date)}W${getISOWeek(date)}`
  if (precision === "month")
    return formatISO(date, { representation: "date" }).slice(0, 7)
  if (precision === "year")
    return formatISO(date, { representation: "date" }).slice(0, 4)
}
