const mongoose = require('mongoose');

const Schema = mongoose.Schema;

mongoose.connect('mongodb+srv://rodryg:zyccAbkaPlUurxPt@cluster.51if8qn.mongodb.net/bitbot?retryWrites=true&w=majority');

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', function() {
  console.log('Connected to MongoDB Atlas');
});

const dataSchema = new Schema({
  orderListId: { type: String, unique: true },
  apiKey: String,
  apiSecret: String,
  date: Date,
  operation: Object,
  time: Number,
  schedule: Object
});

const Data = mongoose.model('order', dataSchema);

async function saveData(orderListId, apiKey, apiSecret, date, operation, time, schedule) {
  const data = new Data({ orderListId, apiKey, apiSecret, date, operation, time, schedule });
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

module.exports = { saveData, deleteData, getData, getAllData };
