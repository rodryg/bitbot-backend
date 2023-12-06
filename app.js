const express = require('express');
const cron = require('node-cron');
const app = express();
const port = 443;

let time = new Date().toUTCString();

// Función que se ejecuta cada 4 segundos
cron.schedule('*/4 * * * * *', () => {
  console.log('Función ejecutada cada 4 segundos');
  time = new Date().toUTCString();
});

app.get('/', (req, res) => {
  // Enviar la variable 'time' en formato UTC
  res.send(`¡Hola Mundo! Hora actual en UTC: ${time}`);
});

app.listen(port, () => {
  console.log(`El servidor está corriendo en http://localhost:${port}`);
});
