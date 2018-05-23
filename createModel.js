const query = require("reactivedb/query")
const patchWithQuery = require("reactivedb/patchWithQuery")
const epvCommonOperators = require("reactivedb/epvCommonOperators")

module.exports = (store, customOperators) =>
  patchWithQuery({
    query: query(customOperators(epvCommonOperators(store))),
    patch: p => {
      store.patch(p)
      return p
    },
  })
