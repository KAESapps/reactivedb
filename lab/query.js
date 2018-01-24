const { observable } = require("kobs")

const isString = require("lodash/isString")
var firstKey = o => Object.keys(o)[0]
const sum = require("lodash/sum")
const every = require("lodash/every")
const difference = require("lodash/difference")
const flow = require("lodash/flow")

const applyPatchForUnorderedList = (value, change) => {
  const newValue = difference(value, change.removed).concat(change.added)
  return newValue
}

const operators = {
  getEntities: {
    incremental: true,
    create: (arg, val, store) => {
      let initValue = Array.from(store.data.keys())
      return {
        getValue: () => initValue,
        transformChange: epvPatch => {
          const newIds = Object.keys(epvPatch)
          const derivedPatch = {
            added: difference(newIds, initValue),
          }
          initValue = newIds
          return derivedPatch
        },
      }
    },
  },
  filterEntities: {
    incremental: true,
    create: (filter, ids /* unordered list*/, store) => {
      const matchFilter = id => {
        return every(filter, (v, k) => store.data.get(id).get(k) === v)
      }
      let initValue = ids.filter(matchFilter)
      return {
        getValue: () => initValue,
        transformChange: change => {
          const derivedChange = {
            added: change.added.filter(matchFilter),
            removed:
              change.removed &&
              change.removed.filter(id => {
                return initValue.indexOf(id)
              }),
          }
          initValue = applyPatchForUnorderedList(initValue, derivedChange)
          return derivedChange
        },
      }
    },
  },
  mapBy: () => () => {},
  sum: () => sum,
  count: () => arr => arr.length,
}

module.exports = store => {
  return queryDesc => {
    const incrementalOperators = []
    const obsTransforms = []
    queryDesc.forEach(step => {
      let opName, opArg
      if (isString(step)) {
        opName = step
      } else {
        opName = firstKey(step)
        opArg = step[opName]
      }

      const operator = operators[opName]
      if (operator.incremental) {
        const parentValue = incrementalOperators.length
          ? incrementalOperators[incrementalOperators.length - 1].getValue()
          : null
        incrementalOperators.push(operator.create(opArg, parentValue, store))
      } else {
        obsTransforms.push(operator(opArg))
      }
    })

    const incrementalTransform = flow(
      incrementalOperators.map(op => op.transformChange)
    )
    const obsTransform = flow(obsTransforms)

    const incrementalValue = observable(
      incrementalOperators[incrementalOperators.length - 1].getValue()
    )
    store.onChange(change => incrementalValue(incrementalTransform(change)))

    return obsTransform(incrementalValue())
  }
}
