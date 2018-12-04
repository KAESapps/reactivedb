// permet d'augmenter un store ayant une méthode "patch" simple avec une
// méthode qui permet de générer un patch à partir d'une query (sous forme d'un array)

module.exports = store => {
  const patch = arg => {
    const p = Array.isArray(arg) ? store.query(arg) : arg
    if (p.err) {
      // allow operator to return explicit error instead of a patch
      return p
    } else if (p.res) {
      // allow operator to return explicit result to client while patching
      p.patch && Object.keys(p.patch).length && store.patch(p.patch)
      return { res: p.res } // on ne retourne pas le patch qui est plutôt de l'implémentation interne (et peut être un peu lourd parfois)
    } else {
      // per default, we return the patch
      //TODO: faut-il vraiment attendre le retour du promise (qui correspond à l'écriture dans le cas d'un persistableStore) ?
      return p && Object.keys(p).length && store.patch(p)
    }
  }
  return {
    query: store.query,
    patch,
  }
}
