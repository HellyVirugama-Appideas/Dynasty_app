const router = require('express').Router();
const fileUpload = require('express-fileupload');

const { checkDriver } = require('../../controllers/driver/authController');
const { uploadImageS3Bucket } = require('../../controllers/uploadController');
const carController = require('../../controllers/driver/carController');

router.get('/get_vehicle_types', carController.getVehicleTypes);

router
    .route('/')
    .get(checkDriver, carController.getCars)
    .post(
        checkDriver,
        uploadImageS3Bucket.fields([
            { name: 'pics', maxCount: 8 },
            { name: 'purchaseBill', maxCount: 1 },
            { name: 'insurance', maxCount: 1 },
            { name: 'rc', maxCount: 1 },
        ]),
        carController.createCar
    );

router.post(
    '/add_image',
    uploadImageS3Bucket.array('pics'),
    checkDriver,
    carController.addImage
);
router.post(
    '/delete_image',
    fileUpload(),
    checkDriver,
    carController.deleteImage
);

router.post(
    '/:id',
    uploadImageS3Bucket.array('pics'),
    checkDriver,
    carController.editCar
);

router.get('/delete/:id', fileUpload(), checkDriver, carController.deleteCar);

module.exports = router;
