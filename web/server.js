const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/invite", (req, res) => {
  res.redirect(
    "https://discord.com/oauth2/authorize?client_id=1453159969103810752&permissions=6755794578369616&integration_type=0&scope=bot"
  );
});

app.get("/discord", (req, res) => {
  res.redirect("https://discord.gg/3qgkYxmVfE");
});

app.listen(PORT, () => {
  console.log(`📚 Documentation server running at http://localhost:${PORT}`);
});

module.exports = app;
