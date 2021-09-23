const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_PRIVATE_KEY);
        req.userData = decoded;
        next();
    } catch (error) {
        return res.json({error: true, message: 'Geçersiz oturum.'});
    }
};