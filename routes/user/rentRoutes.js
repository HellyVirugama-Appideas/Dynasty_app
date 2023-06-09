const router = require('express').Router();
const fileUpload = require('express-fileupload');

const rentController = require('../../controllers/user/rentController');

router.post('/list_cars', fileUpload(), rentController.listCars);

module.exports = router;
