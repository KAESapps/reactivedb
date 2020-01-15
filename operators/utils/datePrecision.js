const precisionOrder = ["year", "month", "day", "hour", "minute", "second"]

module.exports = {
  precisionOrder,
  atLeast: precision => {
    const precisionIndex = precisionOrder.indexOf(precision)
    if (precision === "week")
      return minPrecision => ["year", "week"].indexOf(minPrecision) !== -1
    else
      return minPrecision => {
        const atLeastIdx = precisionOrder.indexOf(minPrecision)
        return atLeastIdx !== -1 && precisionIndex >= atLeastIdx
      }
  },
}
