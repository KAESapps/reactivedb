module.exports = (n, suffix = true) =>
  (n && n.toLocaleString
    ? n.toLocaleString("fr", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    : "") + (suffix ? " €" : "")
