const dotenv = require('dotenv');

const token = (dotenv.config().parsed ?? process.env).ACCESS_TOKEN;
if (token == null) {
  throw new Error('token is empty');
}

exports.TOKEN = token;
