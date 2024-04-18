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

const dataSchema = new Schema({
  orderListId: { type: String, unique: true },
  date: Date,
  operation: Object,
  time: Number,
  schedule: Object
});

const Data = mongoose.model('order', dataSchema);

async function saveData(orderListId, date, operation, time, schedule) {
  const data = new Data({ orderListId, date, operation, time, schedule });
  await data.save();
}

async function deleteData(orderListId) {
  const data = await Data.findOneAndDelete({ orderListId });
  if (!data) {
    throw new Error('Data not found');
  }
  return data;
}

async function getData(orderListId) {
  const data = await Data.findOne({ orderListId });
  if (!data) {
    throw new Error('Data not found');
  }
  return data;
}

async function getAllData() {
  const orders = await Data.find();
  return orders;
}

module.exports = { User, saveData, deleteData, getData, getAllData };
