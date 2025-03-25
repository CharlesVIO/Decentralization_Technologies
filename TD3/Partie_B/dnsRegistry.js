const express = require('express');
const app = express();
const port = 4000;

app.get('/getServer', (req, res) => {
    res.json({ "code": 200, "server": "localhost:3000" });
});

app.listen(port, () => {
    console.log(`Registre DNS en cours sur http://localhost:${port}`);
});