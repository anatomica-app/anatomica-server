const pool = require('../utilities/database');
const errorCodes = require('../routes/errors');

module.exports = (permission) => {
  return (req, res, next) => {
    // Let's check if user have permission to make the request.
    const userID = req.body.user;

    const sql =
      'SELECT * FROM admin_privileges WHERE user = ? AND privilege = ?';

    pool.getConnection(function (err, conn) {
      if (err) res.json({ error: true, message: err.message });
      conn.query(sql, [userID, permission], (error, rows) => {
        conn.release();
        if (error) res.json({ error: true, message: error.message });

        if (!rows[0]) {
          res.json({
            error: true,
            code: errorCodes.PERMISSION_DENIED,
            message: 'Bu işlem için yetkiniz yok.',
          });
        } else {
          delete req.body.user;
          next();
        }
      });
    });
  };
};
