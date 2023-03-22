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
        await User.findByIdAndDelete(req.user.id);

        res.json({ code: '1', message: req.t('deleted') });
    } catch (error) {
        next(error);
    }
};

exports.addressList = async (req, res, next) => {
    try {
        const address_list = await Address.find({ userId: req.user.id });

        res.json({ code: '1', message: req.t('success'), address_list });
    } catch (error) {
        next(error);
    }
};
