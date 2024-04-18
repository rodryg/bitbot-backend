const express = require('express');
const cron = require('node-cron');
const Binance = require('binance-api-node').default;
const app = express();
const port = 80;
const winston = require('winston');
const getIP = require('external-ip')();
const { saveData } = require('./model');
const { router, getOrderOco, scheduledSale } = require('./src/api');
const bodyParser = require('body-parser');
const model = require('./model');
const axios = require('axios');

const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

const sessionMiddleware = session({
  secret: 'secretos',
  resave: false,
  saveUninitialized: false,
  store: new MongoDBStore({
    uri: 'mongodb+srv://rodryg:zyccAbkaPlUurxPt@cluster.51if8qn.mongodb.net/bitbot?retryWrites=true&w=majority',
    collection: 'sesiones'
  }),
});

app.use(sessionMiddleware);

app.use(bodyParser.json());  // para analizar solicitudes con cuerpos en formato JSON

app.use('/', router);

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

// Función que se ejecuta cada ciertos segundos
cron.schedule('*/999 * * * * *', async () => {
  time = new Date().toUTCString();
  
  try {
    // Obtener todas las órdenes de la base de datos
    const orders = await model.getAllData();
    if (orders.length > 0) {
      orders.forEach(async (order) => {
        try {
          // Obtener el session y el orderListId de alguna manera
          const session = { apiKey: process.env.BINANCE_API_KEY, apiSecret: process.env.BINANCE_API_SECRET };
          const orderListId = order.orderListId;

          // Llamar a la función getOrderOco para obtener las órdenes OCO
          const orderOco = await getOrderOco(session, orderListId);

          console.log('orderOco', orderOco);

          // Verificar si se encontró una orden OCO con el orderListId correspondiente
          if (orderOco && orderOco.listOrderStatus != 'ALL_DONE') {
            // Hacer algo con la orden OCO encontrada, por ejemplo, imprimir el orderListId
            console.log('Se encontró la orden OCO');
            console.log(orderOco.orderListId);
          } else {
            // Si no ecuentra la orden en Binance
            console.log('No se ecuentra la orden en Binance');
            try {
              const session = {
                apiKey: process.env.BINANCE_API_KEY,
                apiSecret: process.env.BINANCE_API_SECRET
              };
              const coin = order.operation.symbol.substring(0, 3);
              const schedule = order.schedule;
              const amount = order.operation.orderReports[0].origQty;

              console.log('order.operation.orderReports[0].origQty', amount);

              //Llamada a la ruta '/buy'
              const buyResponse = await axios.post('/buy', {
                session,
                coin,
                amount
              });

              console.log('buyResponse.data');
          
              const response = await axios.post('/scheduledSale', {
                session,
                coin,
                schedule
              });
          
              console.log('response.data');
              //console.log(buyResponse.data);
            } catch (error) {
              console.error(error);
            }
          }
        } catch (error) {
          console.error(error);
        }
      });
    }
  } catch (error) {
    console.error('Error al verificar las órdenes en la base de datos:', error);
  }
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
