const router = require('express').Router();

const driverController = require('../../controllers/admin/driverController');
const { upload } = require('../../middleware/upload');

router.get('/', driverController.getAllDrivers);

// View driver (MUST be before /driver/add, /driver/edit/:id)
router.get('/:id', driverController.viewDriver);

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

module.exports = router;
