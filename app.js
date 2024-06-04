const express = require('express');
const Binance = require('binance-api-node').default;
const app = express();
const port = process.env.PORT;
//const winston = require('winston');
const getIP = require('external-ip')();
const { saveData } = require('./model');
const { router, getOrderOco, scheduledSale } = require('./src/api');
const bodyParser = require('body-parser');
const model = require('./model');

const session = require('express-session');
//const MongoDBStore = require('connect-mongodb-session')(session);
const MongoStore = require('connect-mongo');

/* const sessionMiddleware = session({
  secret: 'secretos',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24, // Esto establecerá la cookie para expirar en 24 horas
    httpOnly: true,
    secure: false // Establecer en 'true' si estás en producción con HTTPS
  },
  store: MongoStore.create({
    mongoUrl: 'mongodb+srv://rodryg:zyccAbkaPlUurxPt@cluster.51if8qn.mongodb.net/bitbot?retryWrites=true&w=majority',
    collectionName: 'sessions'
  })
});
 */
/* const sessionMiddleware = session({
  secret: 'secretos',
  resave: false,
  saveUninitialized: false,
  cookie: {
    path: '/',
    maxAge: 1000 * 60 * 60 * 24, // Esto establecerá la cookie para expirar en 24 horas
    httpOnly: true,
    secure: false //process.env.NODE_ENV === 'production',
  },
 */  /*cookie: {
    httpOnly: true,
    secure: false, // Solo para desarrollo o si no estás usando HTTPS
    sameSite: 'lax' // O 'strict' si quieres una restricción más fuerte
   },*/
/*   store: new MongoDBStore({
    uri: 'mongodb+srv://rodryg:zyccAbkaPlUurxPt@cluster.51if8qn.mongodb.net/bitbot?retryWrites=true&w=majority',
    collection: 'sessions'
  })
}); */

const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN, // Reemplaza con el dominio de tu cliente Next.js
  credentials: true
}));

app.use(bodyParser.json());  // para analizar solicitudes con cuerpos en formato JSON

//app.use(sessionMiddleware);

app.use(session({
  secret: 'secreto',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: 'mongodb+srv://rodryg:zyccAbkaPlUurxPt@cluster.51if8qn.mongodb.net/bitbot?retryWrites=true&w=majority'
  })
}));

/* app.use((req, res, next) => {
  console.log('Session middleware check:', req.session);
  next();
}); */

app.use('/', router);

/* const logger = winston.createLogger({
  transports: [
    new winston.transports.File({ filename: 'output.log' })
  ]
});*/

let time = new Date().toUTCString();
let balance = 'balance';
let errorLog = 'errorLog';
let serverIP = 'serverIP'; // Agregamos una nueva variable para almacenar la IP del servidor

app.get('/', async (req, res) => {
  console.log("binance")
  //logger.info(client);

  getIP((err, ip) => {
    if (err) {
        // Si hay un error, lo manejas aquí
        throw err;
    }
    serverIP = ip;
    //logger.info('serverIP');
    //logger.info(serverIP);
  });

  try {
    // Obtiene la información de la cuenta
    //const info = await client.accountInfo();
    /* balance = info.balances.reduce((total, { asset, free, locked }) => {
      total += `Asset: ${asset}, Available: ${free}, In order: ${locked}\n`;
      return total;
    }, ''); */
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
