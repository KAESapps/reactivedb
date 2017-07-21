const logError = err => err && console.error(err)
const asPromise = require('./asPromise')

// storage must conform to the levelup interface
module.exports = (collection, storage) => {
  // auto load
  return new Promise((resolve, reject) => {
    storage.createReadStream()
      .on('data', data => collection.add(data.value))
      .on('error', reject)
      .on('close', reject)
      .on('end', resolve)
  }).then(function () {
    // auto save
    collection.observer = (op, k, v) => {
      if (op === 'remove') {
        return asPromise(storage, 'del', k).catch(logError)
      } else {
        return asPromise(storage, 'put', k, v).catch(logError)
      }
    }
    return collection
  })
}
