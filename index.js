require('dotenv').config();
const express = require('express');
const app = express();
const cors = require('cors');
const port = process.env.PORT || 9000;

//middleware
app.use(express.json());
app.use(cors());

app.get('/', (req, res) => {
    res.send('Connect 2 study server is running.....');
})

app.listen(port, () => {
    console.log(`Connect 2 study server is on port ${port}`);
})