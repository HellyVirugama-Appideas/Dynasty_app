const router = require('express').Router();

const driverController = require('../../controllers/admin/driverController');
const { upload } = require('../../middleware/upload');

router.get('/', driverController.getAllDrivers);

router
    .route('/add')
    .get(driverController.getAddDriver)
    .post(
        upload.fields([
            { name: 'profile', maxCount: 1 },
            { name: 'licence', maxCount: 1 },
            { name: 'pan', maxCount: 1 },
            { name: 'rc', maxCount: 1 },
        ]),
        driverController.postAddDriver
    );

// View driver (MUST be before /driver/add, /driver/edit/:id)
router.get('/:id', driverController.viewDriver);



router
    .route('/edit/:id')
    .get(driverController.getEditDriver)
    .post(
        upload.fields([
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
router.delete('/delete/:id', driverController.deleteDriver);

// Document approval routes
router.get('/documents/:id', driverController.viewDriverDocuments);
router.post('/approve-document/:id/:docType', driverController.approveDocument);
router.post('/reject-document/:id/:docType', driverController.rejectDocument);
router.post('/approve-all/:id', driverController.approveDriverAndDocuments);
router.post('/reject-all/:id', driverController.rejectDriverCompletely);

// Additional routes
router.get('/ride-details/:rideId', driverController.getDriverRideDetails);
router.get('/earnings-report/:id', driverController.getDriverEarningsReport);

module.exports = router;
