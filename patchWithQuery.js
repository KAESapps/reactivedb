// permet d'augmenter un store ayant une méthode "patch" simple avec une
// méthode qui permet de générer un patch à partir d'une query (sous forme d'un array)

module.exports = store => {
  const patch = arg => {
    const p = Array.isArray(arg) ? store.query(arg) : arg
    return store.patch(p)
  }
  return {
    query: store.query,
    patch,
  }
}
