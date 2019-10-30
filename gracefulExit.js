const DEADLY_SIGNALS = ["SIGTERM", "SIGINT", "SIGBREAK", "SIGHUP"]

module.exports = cb => {
  const gracefulExit = () => {
    Promise.race([
      cb(),
      new Promise(resolve => setTimeout(resolve, 1000 * 15)),
    ]).finally(() => process.exit())
  }

  DEADLY_SIGNALS.forEach(signal =>
    process.on(signal, () => {
      console.log("Received signal", signal)
      gracefulExit()
    })
  )

  process.on("unhandledRejection", (reason, p) => {
    console.log("Unhandled Rejection at:", p, "reason:", reason)
    gracefulExit()
  })
  process.on("uncaughtException", err => {
    console.log("Uncaught exception occurred", err)
    gracefulExit()
  })
}
