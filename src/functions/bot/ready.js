const registerCommands = require("./commandregister");

async function ready(client) {
  console.log(`✅ Logged in as ${client.user.tag}`);
  await registerCommands(client);
  require("../../../web/server");
}

module.exports = ready;
