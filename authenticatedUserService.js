const jwt = require('jsonwebtoken');
const userInfo = (req) => {
  const user = jwt.verify(req.headers.authorization.split(' ')[1], process.env.JWT_PRIVATE_KEY);
  return {
    id: user.id,
    email: user.email,
  };
};

module.exports = userInfo;