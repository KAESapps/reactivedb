const path = require("path")
module.exports = {
  useES5: true,
  useSingleQuotes: false,
  useSemicolons: false,
  includePaths: [
    path.join(__dirname, "client"),
    path.join(__dirname, "common"),
    path.join(__dirname, "mobile"),
    path.join(__dirname, "projets"),
    path.join(__dirname, "server"),
  ],
  excludePatterns: ["**/build/**", "**/package/**"],
}
