const token = process.env.ACCESS_TOKEN;
if (token == null) {
  throw new Error('token is empty');
}

export const TOKEN = token;
