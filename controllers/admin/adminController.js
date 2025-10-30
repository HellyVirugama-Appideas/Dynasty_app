const deleteFile = require('../../utils/deleteFile');

const Country = require('../../models/countryModel');
const City = require('../../models/cityModel');
const Banner = require('../../models/bannerModel');
const Type = require('../../models/typeModel');
const Charge = require('../../models/chargesModel');

const bcrypt = require('bcryptjs');
const Admin = require('../../models/adminModel'); // <-- adjust path if needed


// (async () => {
//     try {
//         const existingAdmin = await Admin.findOne({
//             email: 'admin@gmail.com',
//         });

//         if (existingAdmin) {
//             console.log('⚠️ Admin already exists:', existingAdmin.email);
//         } else {
//             const password = '12345678';
//             const hashedPassword = await bcrypt.hash(password, 12);

//             const newAdmin = await Admin.create({
//                 name: 'Super Admin',
//                 email: 'admin@gmail.com',
//                 // password: hashedPassword,
//                 // passwordConfirm: hashedPassword, // schema will remove this before saving
//                 password: password,
//                 passwordConfirm: password, // schema will remove this before saving
//             });

//             console.log('✅ Admin user created successfully:');
//             console.log('   Email:', newAdmin.email);
//             console.log('   Password:', password);
//         }

//         console.log('🔌 Connection closed, done.');
//     } catch (err) {
//         console.error('❌ Error creating admin:', err.message);
//         process.exit(1);
//     }
// })();

exports.getCountries = async (req, res) => {
    try {
        const countries = await Country.find().sort('-_id');
        res.render('country', { countries });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.getAddCountry = (req, res) => res.render('country_add');

exports.postAddCountry = async (req, res) => {
    try {
        let image;
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }

        await Country.create({
            en: { name: req.body.nameEn },
            fr: { name: req.body.nameFr },
            ar: { name: req.body.nameAr },
            image,
        });

        req.flash('green', 'Country added successfully.');
        res.redirect('/admin/country');
    } catch (error) {
        if (req.file) deleteFile(req.file.path);
        req.flash('red', error.message);
        res.redirect('/admin/country');
    }
};

exports.getEditCountry = async (req, res) => {
    try {
        const country = await Country.findById(req.params.id);
        if (!country) {
            req.flash('red', 'Country not found!');
            return res.redirect('/admin/country');
        }

        res.render('country_edit', { country });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'Country not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/country');
    }
};

exports.postEditCountry = async (req, res) => {
    try {
        const country = await Country.findById(req.params.id);
        if (!country) {
            if (req.file) deleteFile(req.file.path);
            req.flash('red', 'Country not found!');
            return res.redirect('/admin/country');
        }

        const oldImage = country.image;

        country.en.name = req.body.nameEn;
        country.fr.name = req.body.nameFr;
        country.ar.name = req.body.nameAr;

        if (req.file) {
            country.image = `/uploads/${req.file.filename}`;
        }

        await country.save();

        // Delete old image
        if (req.file && oldImage) {
            deleteFile(`public${oldImage}`); // full path
        }

        req.flash('green', 'Country edited successfully.');
        res.redirect('/admin/country');
    } catch (error) {
        if (req.file) deleteFile(req.file.path);
        req.flash('red', error.message);
        res.redirect('/admin/country');
    }
};

exports.getDeleteCountry = async (req, res) => {
    try {
        // Delele country, cities
        const [country] = await Promise.all([
            Country.findByIdAndDelete(req.params.id),
            City.deleteMany({ country: req.params.id }),
        ]);

        // delete old image
        deleteFile(country.image);

        req.flash('green', 'Country deleted successfully.');
        res.redirect('/admin/country');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Country not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/country');
    }
};

exports.getCities = async (req, res) => {
    try {
        const cities = await City.find().sort('-_id').populate('country', 'en');
        res.render('city', { cities });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.getAddCity = async (req, res) => {
    try {
        const countries = await Country.find().sort('-_id');
        res.render('city_add', { countries });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.postAddCity = async (req, res) => {
    try {
        await City.create({
            en: { name: req.body.nameEn },
            fr: { name: req.body.nameFr },
            ar: { name: req.body.nameAr },
            country: req.body.country,
        });

        req.flash('green', 'City added successfully.');
        res.redirect('/admin/city');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/city');
    }
};

exports.getEditCity = async (req, res) => {
    try {
        const [city, countries] = await Promise.all([
            City.findById(req.params.id),
            Country.find().sort('-_id'),
        ]);

        if (!city) {
            req.flash('red', 'City not found!');
            return res.redirect('/admin/city');
        }

        res.render('city_edit', { city, countries });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'City not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/city');
    }
};

exports.postEditCity = async (req, res) => {
    try {
        const city = await City.findById(req.params.id);
        if (!city) {
            req.flash('red', 'City not found!');
            return res.redirect('/admin/city');
        }

        city.en.name = req.body.nameEn;
        city.fr.name = req.body.nameFr;
        city.ar.name = req.body.nameAr;
        city.country = req.body.country;

        await city.save();

        req.flash('green', 'City edited successfully.');
        res.redirect('/admin/city');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/city');
    }
};

exports.getDeleteCity = async (req, res) => {
    try {
        await City.findByIdAndDelete(req.params.id);

        req.flash('green', 'City deleted successfully.');
        res.redirect('/admin/city');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'City not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/city');
    }
};

exports.getBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort('-_id');
        res.render('banner', { banners });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.getAddBanner = (req, res) => res.render('banner_add');

exports.postAddBanner = async (req, res) => {
    try {
        let image;
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }

        await Banner.create({ image });

        req.flash('green', 'Banner added successfully.');
        res.redirect('/admin/banner');
    } catch (error) {
        if (req.file) deleteFile(req.file.path);
        req.flash('red', error.message);
        res.redirect('/admin/banner');
    }
};

exports.getEditBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            req.flash('red', 'Banner not found!');
            return res.redirect('/admin/banner');
        }

        res.render('banner_edit', { banner });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'Banner not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/banner');
    }
};

exports.postEditBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            if (req.file) deleteFile(req.file.path);
            req.flash('red', 'Banner not found!');
            return res.redirect('/admin/banner');
        }

        const oldImage = banner.image;

        if (req.file) {
            banner.image = `/uploads/${req.file.filename}`;
        }

        await banner.save();

        if (req.file && oldImage) {
            deleteFile(`public${oldImage}`);
        }

        req.flash('green', 'Banner edited successfully.');
        res.redirect('/admin/banner');
    } catch (error) {
        if (req.file) deleteFile(req.file.path);
        req.flash('red', error.message);
        res.redirect('/admin/banner');
    }
};


exports.getDeleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findByIdAndDelete(req.params.id);

        // delete old image
        deleteFile(banner.image);

        req.flash('green', 'Banner deleted successfully.');
        res.redirect('/admin/banner');
    } catch (error) {
        if (error.name === 'CastError' || error.name === 'TypeError')
            req.flash('red', 'Banner not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/banner');
    }
};

exports.getTypes = async (req, res) => {
    try {
        const types = await Type.find();
        res.render('type', { types });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.getAddType = (req, res) => res.render('type_add');

exports.postAddType = async (req, res) => {
    try {
        let image;
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        }

        await Type.create({
            en: { name: req.body.nameEn },
            fr: { name: req.body.nameFr },
            ar: { name: req.body.nameAr },
            capacity: req.body.capacity,
            typeFor: req.body.typeFor,
            distanceRate: req.body.distanceRate,
            image,
        });

        req.flash('green', 'Type added successfully.');
        res.redirect('/admin/type');
    } catch (error) {
        if (req.file) deleteFile(req.file.path);
        req.flash('red', error.message);
        res.redirect('/admin/type');
    }
};

exports.getEditType = async (req, res) => {
    try {
        const type = await Type.findById(req.params.id);
        if (!type) {
            req.flash('red', 'Type not found!');
            return res.redirect('/admin/type');
        }

        res.render('type_edit', { type });
    } catch (error) {
        if (error.name === 'CastError') req.flash('red', 'Type not found!');
        else req.flash('red', error.message);
        res.redirect('/admin/type');
    }
};

exports.postEditType = async (req, res) => {
    try {
        const type = await Type.findById(req.params.id);
        if (!type) {
            if (req.file) deleteFile(req.file.path);
            req.flash('red', 'Type not found!');
            return res.redirect('/admin/type');
        }

        const oldImage = type.image;

        type.en.name = req.body.nameEn;
        type.fr.name = req.body.nameFr;
        type.ar.name = req.body.nameAr;
        type.capacity = req.body.capacity;
        type.typeFor = req.body.typeFor;
        type.distanceRate = req.body.distanceRate;

        if (req.file) {
            type.image = `/uploads/${req.file.filename}`;
        }

        await type.save();

        if (req.file && oldImage) {
            deleteFile(`public${oldImage}`);
        }

        req.flash('green', 'Type edited successfully.');
        res.redirect('/admin/type');
    } catch (error) {
        if (req.file) deleteFile(req.file.path);
        req.flash('red', error.message);
        res.redirect('/admin/type');
    }
};

exports.getCharges = async (req, res) => {
    try {
        const charge = await Charge.findOne();
        res.render('charge', { charge });
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin');
    }
};

exports.postCharges = async (req, res) => {
    try {
        await Charge.findOneAndUpdate({}, req.body);

        req.flash('green', 'Charges updated successfully.');
        res.redirect('/admin/charge');
    } catch (error) {
        req.flash('red', error.message);
        res.redirect('/admin/charge');
    }
};
