const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const dataSchema = new Schema({
  key: String,
  secret: String,
  date: Date,
  operationId: String,
  number: Number
});

const Data = mongoose.model('Data', dataSchema);

async function saveData(key, secret, date, operationId, number) {
  const data = new Data({ key, secret, date, operationId, number });
  await data.save();
}

module.exports = { saveData };
