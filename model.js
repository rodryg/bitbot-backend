// model.js
const mongoose = require('mongoose');
const argon2 = require('argon2');
const Schema = mongoose.Schema;

mongoose.connect('mongodb+srv://rodryg:zyccAbkaPlUurxPt@cluster.51if8qn.mongodb.net/bitbot?retryWrites=true&w=majority');

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
  console.log('Connected to MongoDB Atlas');
});

const UserSchema = new Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  apiKey: String,
  apiSecret: String,
});

/*UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await argon2.hash(this.password);
  }
  next();
});*/

/* const sessionSchema = new Schema({
  sessionId: { type: String, unique: true },
}); */

const User = mongoose.model('User', UserSchema);

const orderSchema = new Schema({
  orderListId: { type: String, unique: true },
  date: Date,
  operation: Object,
  time: Number,
  schedule: Object,
  userId: Schema.Types.ObjectId
});

const Order = mongoose.model('order', orderSchema);

/* const Session = mongoose.model('Session', sessionSchema); */

async function saveOrder(orderListId, date, operation, time, schedule, userId) {
  const data = new Order({ orderListId, date, operation, time, schedule, userId });
  await data.save();
}

async function deleteOrder(orderListId) {
  const data = await Order.findOneAndDelete({ orderListId });
/*   if (!data) {
    throw new Error('Order not found');
  } */
  return data;
}

async function getOrder(orderListId) {
  const data = await Order.findOne({ orderListId });
  if (!data) {
    throw new Error('Order not found');
  }
  return data;
}

async function getAllOrders() {
  const orders = await Order.find();
  return orders;
}

async function getOrderByUserId(userId) {
  const data = await Order.findOne({ userId });
  //console.log("getOrderByUserId", userId, data);
  return data;
}

/* 
async function getSessionById(sessionId) {
  const session = await Session.findOne({ sessionId });
  if (!session) {
    throw new Error('Session not found');
  }
  return session;
} */

/* async function findSessionByUserId(userId) {
  console.log("findSessionByUserId(userId)", userId);
  // Convertir el string del ID de usuario a un objeto ObjectId de MongoDB
  const objectIdUserId = new mongoose.Types.ObjectId(userId);

  // Buscar la sesión que contiene el ID de usuario
  const session = await Session.findOne({
    'session.userId': objectIdUserId
  });

  if (!session) {
    throw new Error('Session not found');
  }

  return session;
} */

// Esquema simplificado para la colección de sesiones
const sessionSchema = new Schema({
  _id: String,
  session: {
    // Define solo los campos que necesitas
    userCronJobId: String
  }
}, { collection: 'sessions' }); 

const Session = mongoose.model('Session', sessionSchema);

// Función para obtener el userCronJobId usando el userId
async function getUserCronJobIdByUserId(userId) {
  try {
    console.log("getUserCronJobIdBy UserId:", userId);
    // Suponiendo que 'userId' se almacena en la sesión como una cadena
    const session = await Session.findOne({ 'session.userId': userId });

    if (!session) {
      throw new Error('Session not found');
    }

    // Devolver el userCronJobId de la sesión encontrada
    return session.session.userCronJobId;
  } catch (error) {
    console.error('Error getting userCronJobId by userId:', error);
    throw error;
  }
}

module.exports = { User, Order, saveOrder, deleteOrder, getOrder, getAllOrders, getOrderByUserId, getUserCronJobIdByUserId /* , Session, findSessionByUserId */ /*, getSessionById*/ };
