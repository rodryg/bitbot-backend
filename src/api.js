const express = require('express');
const router = express.Router();
const Binance = require('binance-api-node').default;
const model = require('../model.js');
const { User } = require('../model');
const argon2 = require('argon2');
const jwt = require('jsonwebtoken');

// Configurar la API de Binance
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;

const client = Binance({ apiKey, apiSecret });

// Función para crear un token JWT
function generateAuthToken(userId) {
  // El 'secret' debería ser una cadena secreta almacenada de forma segura
  const secret = process.env.JWT_SECRET;
  // Crear el token con el ID del usuario y una caducidad (por ejemplo, 24 horas)
  return jwt.sign({ userId }, secret, { expiresIn: '24h' });
}

router.post('/register', async (req, res) => {
  const { username, password, apiKey, apiSecret } = req.body;
  const hashedPassword = await argon2.hash(password);
  const user = new User({ username, password: hashedPassword, apiKey, apiSecret });
  await user.save();
  const userOrder = await model.getOrderByUserId(user._id);
  console.log('!!! req.session');
  console.log(req.session);
  req.session.userId = user._id;
  req.session.userOrder = userOrder || {};
  
  // Generar el token después de registrar al usuario
  const authToken = generateAuthToken(user._id);
  
  // Guardar el token en la sesión si es necesario
  req.session.authToken = authToken;

  res.status(200).json({
    message: 'Usuario registrado con éxito',
    userId: req.session.userId,
    userOrder: req.session.userOrder,
    authToken: req.session.authToken
  });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !await argon2.verify(user.password, password)) {
    return res.status(400).send('Nombre de usuario o contraseña incorrectos');
  }
  
  const userOrder = await model.getOrderByUserId(user._id);

  req.session.userId = user._id;
  req.session.userOrder = userOrder || {};
  res.status(200).json({
    message: 'Inicio de sesión exitoso',
    userId: req.session.userId,
    userOrder: req.session.userOrder
  });
});

router.post('/logout', (req, res) => {
  req.session.destroy();
  res.status(200).send('Sesión cerrada con éxito');
});

// Ruta para obtener el balance total del usuario
router.post('/balance', async (req, res) => {
  try {
    const { session } = req.body;
    const { apiKey, apiSecret } = session;

    // Inicializa el cliente de Binance con las claves API y secretas
    const client = Binance({ apiKey, apiSecret });
    
    // Obtener el balance del usuario
    const balance = await client.accountInfo()
    const assets = balance.balances.filter(asset => parseFloat(asset.free) > 0 || parseFloat(asset.locked) > 0)
    // Calcular el balance total en dólares
    let totalBalance = 0
    for (let asset of assets) {
      try {
        let assetBalance = 0
        if(asset.asset != 'USDT') {
          const assetPrice = await client.prices({ symbol: asset.asset + 'USDT' })
          // Convertir el balance del activo en USDT
          assetBalance = parseFloat(asset.free) + parseFloat(asset.locked) * parseFloat(assetPrice[asset.asset + 'USDT'])
        } else {
          assetBalance = parseFloat(asset.free) + parseFloat(asset.locked)
        }
        // Sumar al balance total en dólares
        totalBalance += assetBalance
      } catch (error) {
        console.log(error)
      }
    }
    // Mostrar el balance total en la interfaz
    console.log('#totalBalance', totalBalance);
    res.json(totalBalance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el balance' });
  }
})


// Ruta para obtener el balance de una moneda específica
router.post('/balanceOf', async (req, res) => {
  try {
    const { session, coin } = req.body;

    const balanceOf = await getBalanceOf(session, coin);

    // Devolver el balance convertido a USDT
    console.log('balanceOf,coin', balanceOf, coin);
    res.json(balanceOf);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener el balance' });
  }
});

// Ruta para obtener el balance total del usuario
router.post('/balances', async (req, res) => {
  try {
    const { session } = req.body;
    const { apiKey, apiSecret } = session;

    // Inicializa el cliente de Binance con las claves API y secretas
    const client = Binance({ apiKey, apiSecret });

    // Obtener el balance del usuario
    const balances = await client.accountInfo()
    const assets = balances.balances.filter(asset => parseFloat(asset.free) > 0 || parseFloat(asset.locked) > 0)
    
    // Crear un array de objetos con el asset, el balance y el balance en USDT
    const balancesInUSDT = await Promise.all(assets.map(async asset => {
      // Obtener el precio de la moneda en USDT
      const price = asset.asset != 'USDT' ? await client.avgPrice({ symbol: asset.asset + 'USDT' }) : { price: 1 }
      
      // Calcular el balance en USDT
      const balanceInUSDT = (parseFloat(asset.free) + parseFloat(asset.locked)) * parseFloat(price.price) || 0

      console.log('#balanceInUSDT', balanceInUSDT)

      // Devolver el objeto con el asset, el balance y el balance en USDT
      return {
        asset: asset.asset,
        balance: parseFloat(asset.free) + parseFloat(asset.locked),
        balanceInUSDT: balanceInUSDT.toFixed(2)
      }
    }))
    
    // Mostrar el balance en la interfaz
    res.json(balancesInUSDT);
  } catch (error) {
    console.error(error); 
    res.status(500).json({ error: 'Error al obtener los balances' });
  }
});

router.post('/available', async (req, res) => {
  try {
    const { session, coin } = req.body;
    const { apiKey, apiSecret } = session;

    const availableBalance = await getAvailableBalance({ apiKey, apiSecret }, coin);
    console.log('/available', availableBalance)

    res.json(availableBalance);
  } catch (error) {
    console.error(error);
    res.status(404).json({ error: 'Error al realizar la compra' });
  }
});

// Ruta para comprar una moneda
router.post('/buy', async (req, res) => {
  try {
    const { session, coin, amount } = req.body;
    const { apiKey, apiSecret } = session;
    const symbol = coin + 'USDT';

    // Inicializa el cliente de Binance con las claves API y secretas
    const client = Binance({ apiKey, apiSecret });

    // Obtener el valor mínimo del filtro NOTIONAL para el símbolo
    const exchangeInfo = await client.exchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find(s => s.symbol === symbol);
    const notionFilter = symbolInfo.filters.find(f => f.filterType === 'NOTIONAL');
    console.log("notionFilter");
    console.log(notionFilter);
    console.log("notionFilter");
    const minNotional = parseFloat(notionFilter.minNotional);

    // Consultar el precio actual del símbolo
    const ticker = await client.prices({ symbol });
    const price = parseFloat(ticker[symbol]);

    // Calcular el valor notional de la orden
    const valorNotional = price * parseFloat(amount);

    // Verificar si cumple con el filtro NOTIONAL
    console.log("valorNotional < minNotional");
    console.log(valorNotional < minNotional);
    console.log(valorNotional, minNotional);
    
    if (valorNotional < minNotional) {
      return res.status(400).json({ error: 'La orden no cumple con el filtro NOTIONAL' });
    }

    // Comprar una moneda
    const order = await client.order({
      symbol: symbol,
      side: 'BUY',
      quantity: amount,
      type: 'MARKET'
    });

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al realizar la compra' });
  }
});

// Ruta para vender una moneda
router.post('/sell', async (req, res) => {
  try {
    const { session, coin, amount } = req.body;
    const { apiKey, apiSecret } = session;

    const client = Binance({ apiKey, apiSecret });

    // Vender una moneda
    const order = await client.order({
      symbol: coin + 'USDT',
      side: 'SELL',
      quantity: amount,
      type: 'MARKET'
    })
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al realizar la venta' });
  }
});

// Ruta para obtener la lista de monedas disponibles
router.post('/coins', async (req, res) => {
  try {
    //const { session } = req.body;
    //const { apiKey, apiSecret } = session;

    const client = Binance();

    // Definir las monedas que quieres consultar
    const coins = ['BTC', 'ETH']

    // Obtener los precios de mercado de todos los pares
    const prices = await client.prices()
  
    // Obtener los precios de mercado de cada moneda en USDT
    const pricesObjects = coins.map(coin => {
      const pair = coin + 'USDT'
      const price = coin != 'USDT' ?parseFloat(prices[pair]).toFixed(2) : 1
      return {coin, price}
    })
  
    // Devolver los precios como un array
    console.log('pricesObjects', pricesObjects)
    
    res.json(pricesObjects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la lista de monedas' });
  }
});

// Ruta para obtener moneda
router.post('/coin', async (req, res) => {
  try {
    const { coin } = req.body;

    const price = await getCoinPrice(coin)

    res.json(price);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la lista de monedas' });
  }
});

// Ruta para obtener la cantidad mínima de un par de criptomonedas
router.post('/minQty', async (req, res) => {
  try {
    const { symbol } = req.body;

    const client = Binance();

    // Obtener la información del símbolo
    const info = await client.exchangeInfo();

    // Buscar el par de criptomonedas en la información del símbolo
    const symbolInfo = info.symbols.find(s => s.symbol === symbol);

    // Encontrar el filtro LOT_SIZE
    const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');

    // Obtener la cantidad mínima
    const minQty = lotSizeFilter.minQty;

    // Obtener el stepSize
    const stepSize = lotSizeFilter.stepSize;

    // Mostrar el stepSize en la consola
    console.log(`stepSize: ${stepSize}`);

    res.json(minQty);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener la cantidad mínima' });
  }
});

async function orderOco(session, params) {
  try {
    const { apiKey, apiSecret } = session;

    const client = Binance({ apiKey, apiSecret });

    // Obtén los parámetros necesarios de la solicitud
    const { symbol, side, quantity, price, stopPrice, stopLimitPrice, stopLimitTimeInForce } = params;

    // Realiza la orden OCO utilizando la API de Binance
    const orderOco = await client.orderOco({
      symbol,
      side,
      quantity,
      price,
      stopPrice,
      stopLimitPrice,
      stopLimitTimeInForce
    });

    // Devuelve la respuesta de la orden OCO
    return orderOco;
  } catch (error) {
    console.log('horror', error);
    // Maneja cualquier error que ocurra durante la orden OCO
    throw new Error('Error al realizar la orden OCO');
  }
};

router.post('/scheduledSale', async (req, res) => {
  try {
    const { session, coin, schedule, userId } = req.body;
    const { apiKey, apiSecret } = session;
    const { earnAmount, loseAmount, reSaleTime } = schedule;

    const availableBalance = await getAvailableBalance({ apiKey, apiSecret }, coin);
    const coinPrince = await getCoinPrice(coin);
    console.log('availableBalance', availableBalance);
    console.log('earnAmount, loseAmount, reSaleTime', earnAmount, loseAmount, reSaleTime);

    // Obtén los parámetros necesarios de la solicitud
    const symbol = coin + 'USDT';
    const quantity = (availableBalance * .95).toFixed(5);
    const price = (coinPrince * ((earnAmount / 100) + 1)).toFixed(2);
    const stopPrice = (coinPrince - (coinPrince * (loseAmount / 100))).toFixed(2);
    const stopLimitPrice = stopPrice
    const stopLimitTimeInForce = 'GTC';

    // Validar que se hayan proporcionado todos los parámetros necesarios
    /*if (!symbol || !quantity || !price || !stopPrice || !stopLimitPrice || !stopLimitTimeInForce) {
      return res.status(400).json({ error: 'Faltan parámetros requeridos' });
    }*/

    // Llamada a orderOco con los parámetros necesarios
    const orderOcoResponse = await orderOco(session, {
      symbol,
      side:'SELL',
      quantity,
      price,
      stopPrice,
      stopLimitPrice,
      stopLimitTimeInForce
    });

    const date = new Date();

    const orderListId = orderOcoResponse.orderListId;

    model.saveData(orderListId, date, orderOcoResponse, reSaleTime, schedule, userId);
    console.log('orderOcoResponse', orderOcoResponse, orderListId);
    // Devuelve la respuesta de la orden OCO,
    res.json(orderOcoResponse);
  } catch (error) {
    // Manejar el error
    console.error(error);
    // Maneja cualquier error que ocurra durante la orden OCO
    res.status(500).json({ error: 'Error al realizar la orden OCO' });
  }
});

const getAvailableBalance = async (session, coin) => {
  try {
    const { apiKey, apiSecret } = session;

    let total = 0;

    // Inicializa el cliente de Binance con las claves API y secretas
    const client = Binance({ apiKey, apiSecret });

    // Obtener el balance del usuario
    const balance = await client.accountInfo();
    // Buscar el activo que corresponde a la moneda
    const asset = balance.balances.find((asset) => asset.asset === coin);
    console.log('//AA', asset);
    // Si no se encuentra el activo, retornar cero
    if (asset) {
      // Si se encuentra el activo, sumar el saldo libre y el saldo bloqueado
      const free = parseFloat(asset.free);
      const locked = parseFloat(asset.locked);
      total = free + locked;
    }

    // Retornar el total
    return total.toFixed(5);
  } catch (error) {
    console.error(error);
    throw new Error('Error al obtener el balance disponible');
  }
};

const getCoinPrice = async function(coin) {
  try {
    // Obtener el valor y los datos de una moneda específica
    let price = 0
    if(coin != 'USDT') {
      const exchange = await client.prices({symbol: coin + 'USDT'})
      price = parseFloat(exchange[coin + 'USDT']).toFixed(2)
      //const exchangeInfo = await client.exchangeInfo()
      //const coinInfo = exchangeInfo.symbols.find(symbol => symbol.baseAsset === coin)
    } else {
      price = 1
    }
    // Retornar el precio de la moneda
    return price;
  } catch (error) {
    console.error(error);
    throw new Error('Error al obtener el balance disponible');
  }
}

const getBalanceOf = async function(session, coin) {
  try {
    const { apiKey, apiSecret } = session;

    // Inicializa el cliente de Binance con las claves API y secretas
    const client = Binance({ apiKey, apiSecret });

    // Obtener el balance del usuario
    const balances = await client.accountInfo()
    const assets = balances.balances.filter(asset => parseFloat(asset.free) > 0 || parseFloat(asset.locked) > 0)
    
    // Buscar el asset que tenga el mismo asset.asset que coin
    const asset = assets.find(asset => asset.asset === coin)
    
    // Devolver la suma de asset.free y asset.locked
    const balance = asset ? parseFloat(asset.free) + parseFloat(asset.locked) : 0
    
    // Obtener el precio de la moneda en USDT
    const price = coin != 'USDT' ? await client.avgPrice({ symbol: coin + 'USDT' }) : { price: 1 }
    
    //console.log('balance', balance, price)
    //console.log((balance * parseFloat(price.price)).toFixed(2))
    // Devolver el balance convertido a USDT
    return ((balance * parseFloat(price.price)).toFixed(2));
  } catch (error) {
    console.error(error);
    throw new Error('Error al obtener el balance disponible');
  }
}

const getOrderOco = async function(session, orderListId ) {
  try {
    const { apiKey, apiSecret } = session;

    console.log('session', session);
    
    // Inicializa el cliente de Binance con las claves API y secretas
    const client = Binance({ apiKey, apiSecret });
    
    // Obtener las órdenes OCO del cliente
    const orderOco = await client.getOrderOco({ orderListId });
    
    return orderOco;
  } catch (error) {
    console.error(error);
    throw new Error('Error al obtener las órdenes OCO');
  }
};

const cancelOrderOco = async function(session, orderListId ) {
  try {
    const { session, orderListId } = req.body;
    const { apiKey, apiSecret } = session;
    
    // Inicializa el cliente de Binance con las claves API y secretas
    const client = Binance({ apiKey, apiSecret });
    
    // Cancelar las órdenes OCO del cliente
    const cancelOco = await client.cancelOrderOco({ orderListId });
    
    res.json(cancelOco);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al cancelar las órdenes OCO' });
  }
};

module.exports = {
  router: router,
  getOrderOco: getOrderOco,
  orderOco: orderOco
};