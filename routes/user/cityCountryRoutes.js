const router = require('express').Router();
const fileUpload = require('express-fileupload');

const cityCountryController = require('../../controllers/user/cityCountryController');

router.get('/country', cityCountryController.getCountries);

router.post('/city', fileUpload(), cityCountryController.getCities);

module.exports = router;
