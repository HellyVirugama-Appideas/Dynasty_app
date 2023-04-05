const router = require('express').Router();
const fileUpload = require('express-fileupload');

const rideController = require('../../controllers/user/rideController');

router.post('/get_rides', fileUpload(), rideController.getRides);

module.exports = router;
