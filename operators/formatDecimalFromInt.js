const formatDecimal = require("reactivedb/operators/formatDecimal")

// formatte un entier en tant que décimal à n chiffres après la virgule
// (ex: valeur en centimes à formatter en euros avec 2 décimales)
module.exports = decimals => {
  const toFloat = int => int / Math.pow(10, decimals)
  const formatFloat = formatDecimal(decimals)
  return v => formatFloat(toFloat(v))
}
