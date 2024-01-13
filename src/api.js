const express = require('express');
const router = express.Router();
const Binance = require('binance-api-node').default;

const api = require('./api.js');
const e = require('express');

// Configurar la API de Binance
const apiKey = process.env.API_KEY;
const apiSecret = process.env.API_SECRET;

const client = Binance({ apiKey, apiSecret });

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
    // Obtener el precio actual del dólar
    //const dollarPrice = 0 //await client.futuresPrices({ symbol: 'USDTUSDT' })
    // Calcular el balance total en dólares
    let totalBalance = 0
    //console.log('assets', assets )
    for (let asset of assets) {
      //coins.map(async (coin) => {
        //if(asset.asset == coin) {
          // Obtener el precio del activo en USDT
          //console.log('asset.asset', asset.asset)
          try {
            let assetBalance = 0
            console.log(asset)
            if(asset.asset != 'USDT') {
              const assetPrice = await client.prices({ symbol: asset.asset + 'USDT' })
              
              //console.log('assetPrice', assetPrice[asset.asset + 'USDT'])
              // Convertir el balance del activo en USDT
              assetBalance = parseFloat(asset.free) + parseFloat(asset.locked) * parseFloat(assetPrice[asset.asset + 'USDT'])
              // Sumar al balance total en dólares
            } else {
              assetBalance = parseFloat(asset.free) + parseFloat(asset.locked)
            }
            const price = asset.asset != 'USDT' ? await client.avgPrice({ symbol: asset.asset + 'USDT' }) : { price: 1 }
            totalBalance += assetBalance * price.price //* parseFloat(dollarPrice.price)
          } catch (error) {
            //console.log(error)
          }
       // }
      //})
    }
    // Mostrar el balance total en la interfaz
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

    // Inicializa el cliente de Binance con las claves API y secretas
    const client = Binance({ apiKey, apiSecret });

    // Comprar una moneda
    const order = await client.order({
      symbol: coin + 'USDT',
      side: 'BUY',
      quantity: amount,
      type: 'MARKET'
    })

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
    const { session, coin, schedule } = req.body;
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
    
    // Devuelve la respuesta de la orden OCO
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

    console.log('gogogo', apiKey, apiSecret, coin);

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

module.exports = router;
