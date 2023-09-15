const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkDriver } = require('../../controllers/driver/authController');
const homeController = require('../../controllers/driver/homeController');

// status
router
    .route('/status')
    .get(checkDriver, homeController.getStatus)
    .post(fileUpload(), checkDriver, homeController.setStatus);

// set lan lng
router.post(
    '/set_location',
    fileUpload(),
    checkDriver,
    homeController.setLocation
);

// notifications
router.get('/notification', checkDriver, homeController.getNotifications);

module.exports = router;
