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

UserSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await argon2.hash(this.password);
  }
  next();
});

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

async function saveOrder(orderListId, date, operation, time, schedule, userId) {
  const data = new Order({ orderListId, date, operation, time, schedule, userId });
  await data.save();
}

async function deleteOrder(orderListId) {
  const data = await Order.findOneAndDelete({ orderListId });
  if (!data) {
    throw new Error('Order not found');
  }
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
  return data;
}

module.exports = { User, Order, saveOrder, deleteOrder, getOrder, getAllOrders, getOrderByUserId };
