const router = require('express').Router();

const driverController = require('../../controllers/admin/driverController');
const { uploadImageS3Bucket } = require('../../controllers/uploadController');

router.get('/', driverController.getAllDrivers);

router
    .route('/add')
    .get(driverController.getAddDriver)
    .post(
        uploadImageS3Bucket.fields([
            { name: 'profile', maxCount: 1 },
            { name: 'licence', maxCount: 1 },
            { name: 'pan', maxCount: 1 },
            { name: 'rc', maxCount: 1 },
        ]),
        driverController.postAddDriver
    );

router
    .route('/edit/:id')
    .get(driverController.getEditDriver)
    .post(
        uploadImageS3Bucket.fields([
            { name: 'profile', maxCount: 1 },
            { name: 'licence', maxCount: 1 },
            { name: 'pan', maxCount: 1 },
            { name: 'rc', maxCount: 1 },
        ]),
        driverController.postEditDriver
    );

router.get('/block/:id', driverController.blockDriver);

router.get('/unblock/:id', driverController.unblockDriver);

router.get('/approve/:id', driverController.approveDriver);

module.exports = router;
