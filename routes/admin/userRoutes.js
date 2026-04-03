const router = require('express').Router();

const userController = require('../../controllers/admin/userController');
const {upload} = require("../../middleware/upload")

router.get("/create-user",userController.getAddUser);

router.get('/', userController.getAllUsers);

router.get('/:id', userController.viewUser);

router.get('/block/:id', userController.blockUser);

router.get('/unblock/:id', userController.unblockUser);

router.get('/edit/:id', userController.editUser);

router.put('/update/:id', userController.updateUser);

// Delete
router.delete('/delete/:id', userController.deleteUser);

router.post(
  '/create-user', 
  upload.fields([ 
    { name: 'profile', maxCount: 1 },
  ]),
  userController.createUserByAdmin
);
router.get('/ride-details/:rideId', userController.getUserRideDetails);

module.exports = router;
