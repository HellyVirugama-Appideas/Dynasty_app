const multilingualUser = require('../../utils/multilingual_user');

const User = require('../../models/userModel');
const Address = require('../../models/addressModel');

exports.getProfile = async (req, res, next) => {
    try {
        const user = multilingualUser(req.user, req);

        // Hide fields
        user.blocked = undefined;

        res.json({ code: '1', message: req.t('success'), user });
    } catch (error) {
        next(error);
    }
};

exports.editProfile = async (req, res, next) => {
    try {
        // Not allowed to change
        delete req.body.country_code;
        delete req.body.phone;

        let user = await User.findByIdAndUpdate(req.user.id, req.body, {
            new: true,
        }).populate('city country');

        user = multilingualUser(user, req);

        res.json({ code: '1', message: req.t('success'), user });
    } catch (error) {
        next(error);
    }
};

exports.deleteProfile = async (req, res, next) => {
    try {
        // Delete user, addresses
        await Promise.all([
            User.findByIdAndDelete(req.user.id),
            Address.deleteMany({ userId: req.user.id }),
        ]);

        res.json({ code: '1', message: req.t('deleted') });
    } catch (error) {
        next(error);
    }
};

exports.addressList = async (req, res, next) => {
    try {
        const address_list = await Address.find({ userId: req.user.id }).select(
            '-__v -userId'
        );

        res.json({ code: '1', message: req.t('success'), address_list });
    } catch (error) {
        next(error);
    }
};

exports.selectedCountryCity = async (req, res, next) => {
    try {
        const user = multilingualUser(req.user, req);

        res.json({
            code: '1',
            message: req.t('success'),
            data: { city: user.city, country: user.country },
        });
    } catch (error) {
        next(error);
    }
};
