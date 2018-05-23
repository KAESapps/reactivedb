// convention de signalisation de worker prêt à recevoir des messages

module.exports = {
  // à utiliser côté worker
  signal: transport => transport.postMessage({ method: "ready" }),
  // à utiliser côté client
  wait: transport =>
    new Promise(resolve =>
      transport.onMessage(msg => {
        if (msg.method === "ready") {
          resolve(transport)
        }
      })
    ),
}
