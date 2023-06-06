const Joi = require('joi');
const nodemailer = require('nodemailer');
const smtp = require('nodemailer-smtp-transport');
const responseMessages = require('../utilities/responseMessages');

exports.postContactForm = (req, res) => {
  const schema = Joi.object({
    name: Joi.string().max(64).required(),
    email: Joi.string().max(320).required(),
    subject: Joi.string().max(120).required(),
    message: Joi.string().max(2000).required(),
  });

  const result = schema.validate(req.body);
  if (result.error)
    return res.json({
      message: result.error.details[0].message,
    });

  // Send the mail.
  const transport = nodemailer.createTransport(
    smtp({
      host: process.env.MAILJET_SMTP_SERVER,
      port: 2525,
      auth: {
        user: process.env.MAILJET_API_KEY,
        pass: process.env.MAILJET_SECRET_KEY,
      },
    })
  );

  let message =
    'Name: ' +
    req.body.name +
    '<br>' +
    'E-Mail: ' +
    req.body.email +
    '<br>' +
    'Subject: ' +
    req.body.subject +
    '<br>' +
    'Message: ' +
    req.body.subject +
    '<br>';

  const json = transport.sendMail({
    from: 'Anatomica <' + process.env.MAIL_USER + '>',
    to: 'info@anatomica-app.com',
    subject: req.body.subject,
    html: message,
  });

  return res.json({
    message: responseMessages.CONTACT_FORM_CREATED,
  });
};