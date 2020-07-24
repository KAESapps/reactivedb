const CURRENCY_SYMBOL = process.env.CURRENCY_SYMBOL || "€"
module.exports = (n, suffix = true) =>
  (n && n.toLocaleString
    ? n.toLocaleString("fr", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "") + (suffix ? ` ${CURRENCY_SYMBOL}` : "")
