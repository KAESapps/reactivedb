const isString = require("lodash/isString")
// prend un time en ISO string sans timezone
// et le formate en texte à la précision voulue
//implémentation simpliste pour l'instant

module.exports = (n, options) => {
  if (!n || !isString(n)) return ""

  if (options.precision === "second") {
    return n.slice(0, 8)
  }
  return n.slice(0, 5) //précision à la minute par défaut
}
