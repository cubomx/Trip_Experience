
const express = require('express');

const router = express.Router();
const server = require('./app');


router.get('*', (req, res) =>{
  res.end('Page not Found');
});



module.exports = router;
