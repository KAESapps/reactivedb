const formatISO = require("date-fns/formatISO")
module.exports = (isoDateTime) =>
  isoDateTime
    ? formatISO(new Date(isoDateTime), { representation: "date" })
    : null
