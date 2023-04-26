const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkUser } = require('../../controllers/user/authController');
const rideController = require('../../controllers/user/rideController');

router.post('/get_vehicle_types', fileUpload(), rideController.getVehicleTypes);

router.post('/book_ride', fileUpload(), checkUser, rideController.bookRide);

module.exports = router;
