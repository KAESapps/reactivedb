// permet d'augmenter un store ayant une méthode "patch" simple avec une
// méthode qui permet de générer un patch à partir d'une query (sous forme d'un array)
const log = require("./log").sub("patch")

module.exports = (store) => {
  const handleRet = (p, arg, metadata) => {
    if (!p) {
      log.info("command without response", {
        cmd: arg,
        err: "noResponse",
        metadata,
      })
      return
    }
    if (p.err) {
      // allow operator to return explicit error instead of a patch
      log.info("command refused", {
        cmd: arg,
        err: p.err,
        metadata,
      })
      return p
    } else if (p.res !== undefined) {
      // allow operator to return explicit result to client while patching
      log.debug("command accepted", {
        cmd: arg,
        res: p.res,
        patch: p.patch,
        metadata,
      })
      if (p.patch && Object.keys(p.patch).length) {
        store.patch(p.patch, metadata)
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

  const patch = (arg, metadata) => {
    const ret = Array.isArray(arg) ? store.query(arg) : arg
    // TODO: on ne retourne un promise que si la création du patch est asynchrone car sinon ça casse la synchro mobile.... pas terrible !!!
    return ret && ret.then
      ? ret
          .then((p) => handleRet(p, arg, metadata))
          .catch((err) => {
            log.error("patching error", { arg, metadata }, err)
            return { err: err + "" }
          })
      : handleRet(ret, arg, metadata)
  }

  return {
    query: store.query,
    patch,
  }
}
