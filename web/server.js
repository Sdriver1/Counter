const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`📚 Documentation server running at http://localhost:${PORT}`);
});

module.exports = app;
