const router = require('express').Router();
const fileUpload = require('express-fileupload');

const authController = require('../../controllers/driver/authController');
const { upload } = require('../../controllers/uploadController');

router.post('/send_otp', fileUpload(), authController.sendOTP);

router.post('/verify_otp', fileUpload(), authController.verifyOTP);

router.post(
    '/create_profile',
    upload.single('profile'),
    authController.createProfile
);

router.post('/social_login', fileUpload(), authController.socialLogin);

router.post(
    '/create_social_profile',
    upload.single('profile'),
    authController.createSocialProfile
);

router.get('/get_vehicle_types', authController.getVehicleTypes);
router.post(
    '/select_vehicle_type',
    fileUpload(),
    authController.checkDriver,
    authController.selectVehicleType
);

router.get('/get_docs', authController.checkDriver, authController.getDocs);
router.post(
    '/upload/profile',
    authController.checkDriver,
    upload.single('profile'),
    authController.uploadProfile
);
router.post(
    '/upload/licence',
    authController.checkDriver,
    upload.single('licence'),
    authController.uploadLicence
);
router.post(
    '/upload/pan',
    authController.checkDriver,
    upload.single('pan'),
    authController.uploadPAN
);
router.post(
    '/upload/rc',
    authController.checkDriver,
    upload.single('rc'),
    authController.uploadRC
);

module.exports = router;
