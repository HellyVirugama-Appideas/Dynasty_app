const router = require('express').Router();
const fileUpload = require('express-fileupload');

const userController = require('../../controllers/api/userController');

router.get('/country', userController.getCountries);

router.post('/city', fileUpload(), userController.getCities);

module.exports = router;
