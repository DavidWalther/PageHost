const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4173;

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/fixtures', express.static(path.join(__dirname, 'fixtures')));

app.listen(PORT, () => {
  console.log(`Test server listening on http://localhost:${PORT}`);
});
