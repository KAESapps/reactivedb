const precisionOrder = ["year", "month", "day", "hour", "minute"]

module.exports = {
  precisionOrder,
  atLeast: precision => {
    const precisionIndex = precisionOrder.indexOf(precision)

    return minPrecision => {
      return precisionIndex >= precisionOrder.indexOf(minPrecision)
    }
  },
}
