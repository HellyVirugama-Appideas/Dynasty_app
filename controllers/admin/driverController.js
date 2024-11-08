const deleteFile = require('../../utils/deleteFile');
const S3 = require('../../helpers/s3');

const Driver = require('../../models/driverModel');
const City = require('../../models/cityModel');
const Country = require('../../models/countryModel');
const Type = require('../../models/typeModel');

exports.getAllDrivers = async (req, res) => {
    try {
        const drivers = await Driver.find({ isDeleted: false })
            .select('+approved +blocked')
            .sort('-_id');

        res.render('driver', { drivers });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.getAddDriver = async (req, res) => {
    try {
        const [cities, countries, types] = await Promise.all([
            City.aggregate([
                { $addFields: { name: '$en.name' } },
                { $unset: ['en', 'fr', 'ar'] },
                { $group: { _id: '$country', cities: { $push: '$$ROOT' } } },
            ]),
            Country.find().sort('en.name'),
            Type.find(),
        ]);

        res.render('driver_add', { cities, countries, types });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.postAddDriver = async (req, res) => {
    try {
        const [profile, licence, pan, rc] = await Promise.all([
            req.files.profile ? S3.uploadFile(req.files.profile[0]) : undefined,
            req.files.licence ? S3.uploadFile(req.files.licence[0]) : undefined,
            req.files.pan ? S3.uploadFile(req.files.pan[0]) : undefined,
            req.files.rc ? S3.uploadFile(req.files.rc[0]) : undefined,
        ]);

        await Driver.create({
            name: req.body.name,
            email: req.body.email,
            country_code: req.body.country_code,
            phone: req.body.phone,
            city: req.body.city,
            country: req.body.country,
            address: req.body.address,
            type: req.body.type,
            profile: profile.Location ? profile.Location : undefined,
            licence: licence.Location ? licence.Location : undefined,
            pan: pan.Location ? pan.Location : undefined,
            rc: rc.Location ? rc.Location : undefined,
            approved: true,
        });

        req.flash('green', 'Driver added successfully.');
        res.redirect('/admin/driver');
    } catch (error) {
        if (error.code == 11000)
            req.flash(
                'red',
                `${Object.values(error.keyValue)[0]} is already registered.`
            );
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.getEditDriver = async (req, res) => {
    try {
        const [driver, cities, countries, types] = await Promise.all([
            Driver.findById(req.params.id),
            City.aggregate([
                { $addFields: { name: '$en.name' } },
                { $unset: ['en', 'fr', 'ar'] },
                { $group: { _id: '$country', cities: { $push: '$$ROOT' } } },
            ]),
            Country.find().sort('en.name'),
            Type.find(),
        ]);

        const citiesInSelectedCountry = cities.find(
            item => item._id == driver.country?.toString()
        )?.cities;

        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        res.render('driver_edit', {
            driver,
            cities,
            countries,
            types,
            citiesInSelectedCountry,
        });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'Driver not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.postEditDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        driver.name = req.body.name;
        driver.email = req.body.email;
        driver.country_code = req.body.country_code;
        driver.phone = req.body.phone;
        driver.country = req.body.country || undefined;
        driver.city = req.body.city || undefined;
        driver.address = req.body.address;
        driver.type = req.body.type || undefined;

        if (req.files.profile && req.files.profile[0]) {
            const result = await S3.uploadFile(req.files.profile[0]);
            driver.profile = result.Location;
        }
        if (req.files.licence && req.files.licence[0]) {
            const result = await S3.uploadFile(req.files.licence[0]);
            driver.licence = result.Location;
        }
        if (req.files.pan && req.files.pan[0]) {
            const result = await S3.uploadFile(req.files.pan[0]);
            driver.pan = result.Location;
        }
        if (req.files.rc && req.files.rc[0]) {
            const result = await S3.uploadFile(req.files.rc[0]);
            driver.rc = result.Location;
        }

        await driver.save();

        req.flash('green', 'Driver edited successfully.');
        res.redirect('/admin/driver');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.blockDriver = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { blocked: true },
            { strict: false }
        );
        req.flash('green', `'${driver.name}' blocked successfully.`);
        res.redirect('/admin/driver');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Driver not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.unblockDriver = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { blocked: false },
            { strict: false }
        );
        req.flash('green', `'${driver.name}' unblocked successfully.`);
        res.redirect('/admin/driver');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Driver not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.approveDriver = async (req, res) => {
    try {
        const driver = await Driver.findByIdAndUpdate(
            req.params.id,
            { approved: true },
            { strict: false }
        );

        req.flash('green', `'${driver.name}' approved successfully.`);
        res.redirect('/admin/driver');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Driver not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};
