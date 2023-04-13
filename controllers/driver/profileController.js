const multilingualUser = require('../../utils/multilingualUser');

const Driver = require('../../models/driverModel');

exports.getProfile = async (req, res, next) => {
    try {
        const driver = multilingualUser(req.driver, req);

        // Hide fields
        driver.blocked = undefined;
        driver.location = undefined;

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

exports.editProfile = async (req, res, next) => {
    try {
        // Not allowed to change
        delete req.body.country_code;
        delete req.body.phone;
        delete req.body.googleId;
        delete req.body.facebookId;
        delete req.body.appleId;

        let driver = await Driver.findByIdAndUpdate(req.driver.id, req.body, {
            new: true,
        }).populate('city country');

        driver = multilingualUser(driver, req);

        res.json({ code: '1', message: req.t('success'), driver });
    } catch (error) {
        next(error);
    }
};

exports.deleteProfile = async (req, res, next) => {
    try {
        // Delete driver
        await Driver.findByIdAndDelete(req.driver.id);

        res.json({ code: '1', message: req.t('deleted') });
    } catch (error) {
        next(error);
    }
};
