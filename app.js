const express = require('express');
const cron = require('node-cron');
const Binance = require('binance-api-node').default;
const app = express();
const port = 80;
const winston = require('winston');
const getIP = require('external-ip')();
const { saveData } = require('./model');
const apiRoutes = require('./src/api');
const bodyParser = require('body-parser');

app.use(bodyParser.json());  // para analizar solicitudes con cuerpos en formato JSON

app.use('/', apiRoutes);

const logger = winston.createLogger({
  transports: [
    new winston.transports.File({ filename: 'output.log' })
  ]
});

let time = new Date().toUTCString();
let balance = 'balance';
let errorLog = 'errorLog';
let serverIP = 'serverIP'; // Agregamos una nueva variable para almacenar la IP del servidor

// Configura tu cliente de Binance
const client = new Binance({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_API_SECRET
});

// Función que se ejecuta cada 4 segundos
cron.schedule('*/4 * * * * *', () => {
  time = new Date().toUTCString();
});

app.get('/', async (req, res) => {
  console.log("binance")
  logger.info(client);

  getIP((err, ip) => {
    if (err) {
        // Si hay un error, lo manejas aquí
        throw err;
    }
    serverIP = ip;
    logger.info('serverIP');
    logger.info(serverIP);
  });

  try {
    // Obtiene la información de la cuenta
    const info = await client.accountInfo();
    balance = info.balances.reduce((total, { asset, free, locked }) => {
      total += `Asset: ${asset}, Available: ${free}, In order: ${locked}\n`;
      return total;
    }, '');
  } catch (error) {
    console.error(error);
    logger.error(error.toString());
    errorLog += `Error: ${error}\n`;
  }

  // Enviar la variable 'time', 'balance', 'errorLog', 'serverIP' y las variables de entorno en formato UTC
  res.send(`¡Bitbot! Hora actual en UTC: ${time}\nBalance:\n${balance}\nErrores:\n${errorLog}\nIP del servidor: ${serverIP}`);
});

app.post('/data', async (req, res) => {
  const { key, secret, date, operationId, number } = req.body;
  try {
    await saveData(key, secret, date, operationId, number);
    res.status(200).json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred while saving data' });
  }
});

app.listen(port, () => {
  console.log(`El servidor está corriendo en http://localhost:${port}`);
});
