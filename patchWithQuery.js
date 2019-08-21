// permet d'augmenter un store ayant une méthode "patch" simple avec une
// méthode qui permet de générer un patch à partir d'une query (sous forme d'un array)
const log = require("./log").sub("patch")

module.exports = store => {
  const patch = (arg, metadata) => {
    const p = Array.isArray(arg) ? store.query(arg) : arg
    if (p.err) {
      // allow operator to return explicit error instead of a patch
      log.info("command refused", { cmd: arg, err: p.err, metadata })
      return p
    } else if (p.res) {
      // allow operator to return explicit result to client while patching
      log.debug("command accepted", {
        cmd: arg,
        res: p.res,
        patch: p.patch,
        metadata,
      })
      if (p.patch && Object.keys(p.patch).length) {
        store.patch(p.patch, metadata)
      } else {
        log.warn("empty patch")
      }
      return { res: p.res } // on ne retourne pas le patch qui est plutôt de l'implémentation interne (et peut être un peu lourd parfois)
    } else {
      // per default, we return the patch
      //TODO: faut-il vraiment attendre le retour du promise (qui correspond à l'écriture dans le cas d'un persistableStore) ?
      if (p && Object.keys(p).length) {
        log.debug("patch accepted", {
          patch: p,
          metadata,
        })
        return store.patch(p, metadata)
      } else {
        log.warn("empty patch")
      }
    }
  }
  return {
    query: store.query,
    patch,
  }
}
