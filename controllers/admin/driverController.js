const deleteFile = require('../../utils/deleteFile');

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
        // 1. Extract file paths
        const profile = req.files?.profile?.[0] ? `/uploads/${req.files.profile[0].filename}` : undefined;
        const licence = req.files?.licence?.[0] ? `/uploads/${req.files.licence[0].filename}` : undefined;
        const pan = req.files?.pan?.[0] ? `/uploads/${req.files.pan[0].filename}` : undefined;
        const rc = req.files?.rc?.[0] ? `/uploads/${req.files.rc[0].filename}` : undefined;

        // 2. Create driver
        await Driver.create({
            name: req.body.name,
            email: req.body.email,
            country_code: req.body.country_code,
            phone: req.body.phone,
            city: req.body.city,
            country: req.body.country,
            address: req.body.address,
            type: req.body.type,
            profile,
            licence,
            pan,
            rc,
            approved: true,
        });

        req.flash('green', 'Driver added successfully.');
        res.redirect('/admin/driver');
    } catch (error) {
        // 3. Delete uploaded files on error
        const files = [
            req.files?.profile?.[0],
            req.files?.licence?.[0],
            req.files?.pan?.[0],
            req.files?.rc?.[0]
        ].filter(Boolean);

        files.forEach(file => deleteFile(file.path));

        if (error.code === 11000) {
            req.flash('red', `${Object.values(error.keyValue)[0]} is already registered.`);
        } else {
            req.flash('red', error.message);
        }
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
            // Delete new files if driver not found
            const files = [
                req.files?.profile?.[0],
                req.files?.licence?.[0],
                req.files?.pan?.[0],
                req.files?.rc?.[0]
            ].filter(Boolean);
            files.forEach(file => deleteFile(file.path));

            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        // 1. Update text fields
        driver.name = req.body.name;
        driver.email = req.body.email;
        driver.country_code = req.body.country_code;
        driver.phone = req.body.phone;
        driver.country = req.body.country || undefined;
        driver.city = req.body.city || undefined;
        driver.address = req.body.address;
        driver.type = req.body.type || undefined;

        // 2. Handle file updates
        if (req.files?.profile?.[0]) {
            if (driver.profile) deleteFile(`public${driver.profile}`);
            driver.profile = `/uploads/${req.files.profile[0].filename}`;
        }
        if (req.files?.licence?.[0]) {
            if (driver.licence) deleteFile(`public${driver.licence}`);
            driver.licence = `/uploads/${req.files.licence[0].filename}`;
        }
        if (req.files?.pan?.[0]) {
            if (driver.pan) deleteFile(`public${driver.pan}`);
            driver.pan = `/uploads/${req.files.pan[0].filename}`;
        }
        if (req.files?.rc?.[0]) {
            if (driver.rc) deleteFile(`public${driver.rc}`);
            driver.rc = `/uploads/${req.files.rc[0].filename}`;
        }

        await driver.save();

        req.flash('green', 'Driver edited successfully.');
        res.redirect('/admin/driver');
    } catch (error) {
        // Delete new files on error
        const files = [
            req.files?.profile?.[0],
            req.files?.licence?.[0],
            req.files?.pan?.[0],
            req.files?.rc?.[0]
        ].filter(Boolean);
        files.forEach(file => deleteFile(file.path));

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
exports.deleteDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id);
        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        // Delete uploaded files
        const files = [driver.profile, driver.licence, driver.pan, driver.rc]
            .filter(Boolean)
            .map(path => `public${path}`);
        files.forEach(file => deleteFile(file));

        await Driver.findByIdAndDelete(req.params.id);

        req.flash('green', `'${driver.name}' deleted successfully.`);
        res.redirect('/admin/driver');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/driver');
    }
};

exports.viewDriver = async (req, res) => {
    try {
        const driver = await Driver.findById(req.params.id)
            .select('+blocked +approved')
            .populate('city', 'en.name')
            .populate('country', 'en.name')
            .populate('type', 'en.name');

        if (!driver) {
            req.flash('red', 'Driver not found!');
            return res.redirect('/admin/driver');
        }

        res.render('driver_view', { driver });
    } catch (error) {
        if (error.name === 'CastError') {
            req.flash('red', 'Driver not found!');
        } else {
            req.flash('red', error.message);
        }
        res.redirect('/admin/driver');
    }
};