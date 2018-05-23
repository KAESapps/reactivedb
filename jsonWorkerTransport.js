module.exports = w => {
  let onCloseCb
  const postMessage = data => w.postMessage(JSON.stringify(data))
  const onMessage = cb => {
    w.onmessage = e => {
      if (e.data === "close") {
        w.onmessage = null
        return onCloseCb && onCloseCb()
      }
      try {
        const data = JSON.parse(e.data)
        cb && cb(data) // est-ce judicieux d'appeler le cb dans le try ?
      } catch (err) {
        postMessage({ err: err.message, msg: e.data })
      }
    }
  }
  const close = () => {
    w.onmessage = null
    w.postMessage("close")
  }
  const onClose = cb => {
    onCloseCb = cb
  }
  return { postMessage, onMessage, close, onClose }
}
