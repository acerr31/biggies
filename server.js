require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

// ── Cloudinary setup ──
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for review photos
const reviewStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'plated/reviews',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit' }]
  },
});

// Storage for restaurant photos
const restaurantStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'plated/restaurants',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, crop: 'limit' }]
  },
});

const uploadReview = multer({
  storage: reviewStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const uploadRestaurant = multer({
  storage: restaurantStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Storage for profile photos
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'plated/profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }]
  },
});

const uploadProfile = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the "public" folder
app.use(express.static('public'));

//////////////////////////////////////
//ROUTES TO SERVE HTML FILES
//////////////////////////////////////
// Default route to serve logon.html
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/logon.html');
});

// Route to serve dashboard.html
app.get('/dashboard', (req, res) => {
    res.sendFile(__dirname + '/public/dashboard.html');
});

// Route to serve editProfile.html
app.get('/edit-profile', (req, res) => {
    res.sendFile(__dirname + '/public/editProfile.html');
});

// profile route
app.get('/profile', (req, res) => {
    res.sendFile(__dirname + '/public/profile.html');
});

//////////////////////////////////////
//END ROUTES TO SERVE HTML FILES
//////////////////////////////////////


/////////////////////////////////////////////////
//HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////
// Helper function to create a MySQL connection
async function createConnection() {
    return await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT,
    });
}

// **Authorization Middleware: Verify JWT Token and Check User in Database**
async function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid token.' });
        }

        try {
            const connection = await createConnection();

            const [rows] = await connection.execute(
                'SELECT email FROM users WHERE email = ?',
                [decoded.email]
            );

            await connection.end();

            if (rows.length === 0) {
                return res.status(403).json({ message: 'Account not found or deactivated.' });
            }

            req.user = decoded;
            next();
        } catch (dbError) {
            console.error(dbError);
            res.status(500).json({ message: 'Database error during authentication.' });
        }
    });
}
/////////////////////////////////////////////////
//END HELPER FUNCTIONS AND AUTHENTICATION MIDDLEWARE
/////////////////////////////////////////////////


//////////////////////////////////////
//ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////
// Route: Create Account
app.post('/api/create-account', async (req, res) => {
    const { email, password, username, first_name, last_name, phone_number } = req.body;

    if (!email || !username || !password || !first_name || !last_name || !phone_number) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    try {
        const connection = await createConnection();
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await connection.execute(
            'INSERT INTO users (email, username, password, first_name, last_name, phone_number) VALUES (?, ?, ?, ?, ?, ?)',
            [email, username, hashedPassword, first_name, last_name, phone_number]
        );

        await connection.end();

        res.status(201).json({ message: 'Account created successfully!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(409).json({ message: 'An account with this email, username, and or phone number already exists.' });
        } else {
            console.error(error);
            res.status(500).json({ message: 'Error creating account.' });
        }
    }
});

// Route: Get Profile
app.get('/api/profile', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            `SELECT email, username, first_name, last_name, phone_number, profile_photo
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [req.user.email]
        );

        await connection.end();

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching profile.' });
    }
});

// Route: Upload profile photo
app.post('/api/profile/photo', authenticateToken, uploadProfile.single('photo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No photo uploaded.' });
        }
        const photoUrl = req.file.path;
        const connection = await createConnection();
        await connection.execute(
            'UPDATE users SET profile_photo = ? WHERE email = ?',
            [photoUrl, req.user.email]
        );
        await connection.end();
        res.status(200).json({ profile_photo: photoUrl });
    } catch (error) {
        console.error('Error uploading profile photo:', error);
        res.status(500).json({ message: 'Error uploading profile photo.' });
    }
});

// Route: Update Profile (username/first/last/phone)
app.put('/api/profile', authenticateToken, async (req, res) => {
    const { username, first_name, last_name, phone_number } = req.body;

    if (!username || !first_name || !last_name) {
        return res.status(400).json({ message: 'Username, first name, and last name are required.' });
    }

    if (phone_number && !/^\d{10,15}$/.test(phone_number)) {
        return res.status(400).json({ message: 'Phone number must be 10–15 digits (numbers only).' });
    }

    try {
        const connection = await createConnection();

        await connection.execute(
            `UPDATE users
             SET username = ?, first_name = ?, last_name = ?, phone_number = ?
             WHERE email = ?`,
            [username, first_name, last_name, phone_number || null, req.user.email]
        );

        const [rows] = await connection.execute(
            `SELECT email, username, first_name, last_name, phone_number
             FROM users
             WHERE email = ?
             LIMIT 1`,
            [req.user.email]
        );

        await connection.end();

        if (rows.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        return res.status(200).json(rows[0]);

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username and/or phone number already exists.' });
        }
        console.error(error);
        return res.status(500).json({ message: 'Error updating profile.' });
    }
});

// Route: Logon
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        await connection.end();

        if (rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const users = rows[0];

        const isPasswordValid = await bcrypt.compare(password, users.password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign(
            { email: users.email },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(200).json({ token });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});

// Route: Get All Email Addresses
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT email FROM users'
        );

        await connection.end();

        const emailList = rows.map(row => row.email);
        res.status(200).json({ emails: emailList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving users.' });
    }
});

// Route: Restaurant Submission Form — accepts photos and uploads to Cloudinary
app.post("/api/restaurants", authenticateToken, uploadRestaurant.array("photos", 6), async (req, res) => {
  try {
    let payload;
    try {
      payload = JSON.parse(req.body.data);
    } catch {
      return res.status(400).json({ message: "Invalid restaurant data." });
    }

    const {
      restaurantName,
      phone,
      address,
      website,
      tags,
      about,
      amenities,
      timeToVisit,
      notes,
      mondayHours,
      tuesdayHours,
      wednesdayHours,
      thursdayHours,
      fridayHours,
      saturdayHours,
      sundayHours,
      email
    } = payload;

    if (!restaurantName || !phone || !address || !about || !tags) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const connection = await createConnection();

    const sql = `
    INSERT INTO restaurants
    (
        restaurantName,
        phone,
        address,
        website,
        tags,
        about,
        amenities,
        timeToVisit,
        notes,
        mondayHours,
        tuesdayHours,
        wednesdayHours,
        thursdayHours,
        fridayHours,
        saturdayHours,
        sundayHours,
        email
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      restaurantName,
      phone,
      address,
      website,
      tags,
      about,
      amenities,
      timeToVisit,
      notes,
      mondayHours,
      tuesdayHours,
      wednesdayHours,
      thursdayHours,
      fridayHours,
      saturdayHours,
      sundayHours,
      email
    ];

    const [result] = await connection.execute(sql, values);
    const restaurantId = result.insertId;

    // Insert Cloudinary photo URLs into restaurant_photos
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await connection.execute(
          "INSERT INTO restaurant_photos (restaurant_id, file_path) VALUES (?, ?)",
          [restaurantId, file.path]
        );
      }
    }

    await connection.end();

    res.status(201).json({
      message: "Restaurant submitted successfully",
      id: restaurantId
    });

  } catch (error) {
    console.error("Error submitting restaurant:", error);
    res.status(500).json({ message: "Server error while submitting restaurant" });
  }
});

// Route: GET /api/restaurants — fetch all restaurants with average rating and first photo
// ADD THIS BLOCK just before the existing: app.get("/api/restaurants/:id", ...)
app.get("/api/restaurants", async (req, res) => {
  try {
    const connection = await createConnection();

    // Fetch all restaurants with their computed average star rating
    const [restaurants] = await connection.execute(`
  SELECT
    r.restaurant_ID,
    r.restaurantName,
    r.phone,
    r.address,
    r.website,
    r.tags,
    r.about,
    r.amenities,
    r.timeToVisit,
    r.notes,
    r.mondayHours,
    r.tuesdayHours,
    r.wednesdayHours,
    r.thursdayHours,
    r.fridayHours,
    r.saturdayHours,
    r.sundayHours,
    AVG(rv.stars) AS avg_rating,
    COUNT(rv.id)  AS review_count
  FROM restaurants r
  LEFT JOIN reviews rv ON rv.restaurant_id = r.restaurant_ID
  GROUP BY
    r.restaurant_ID,
    r.restaurantName,
    r.phone,
    r.address,
    r.website,
    r.tags,
    r.about,
    r.amenities,
    r.timeToVisit,
    r.notes,
    r.mondayHours,
    r.tuesdayHours,
    r.wednesdayHours,
    r.thursdayHours,
    r.fridayHours,
    r.saturdayHours,
    r.sundayHours
  ORDER BY r.restaurantName ASC
`);

    if (restaurants.length === 0) {
      await connection.end();
      return res.status(200).json({ restaurants: [] });
    }

    // Fetch the first photo for each restaurant in one query
    const ids = restaurants.map(r => r.restaurant_ID);
    const placeholders = ids.map(() => "?").join(",");

    const [photoRows] = await connection.execute(
      `SELECT restaurant_id, MIN(id) AS first_photo_id, file_path
       FROM restaurant_photos
       WHERE restaurant_id IN (${placeholders})
       GROUP BY restaurant_id`,
      ids
    );

    // Build a quick lookup map: restaurantId -> first photo URL
    const photoMap = {};
    photoRows.forEach(p => { photoMap[p.restaurant_id] = p.file_path; });

    // Attach the first photo URL to each restaurant
    const enriched = restaurants.map(r => ({
      ...r,
      photos: photoMap[r.restaurant_ID] ? [photoMap[r.restaurant_ID]] : []
    }));

    await connection.end();
    res.status(200).json({ restaurants: enriched });

  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ message: "Server error while fetching restaurants" });
  }
});

///route get photos:
app.get("/api/restaurants", async (req, res) => {
  try {
    const connection = await createConnection();

    // Fetch all restaurants with their computed average star rating
    const [restaurants] = await connection.execute(`
  SELECT
    r.restaurant_ID,
    r.restaurantName,
    r.phone,
    r.address,
    r.website,
    r.tags,
    r.about,
    r.amenities,
    r.timeToVisit,
    r.notes,
    r.mondayHours,
    r.tuesdayHours,
    r.wednesdayHours,
    r.thursdayHours,
    r.fridayHours,
    r.saturdayHours,
    r.sundayHours,
    AVG(rv.stars) AS avg_rating,
    COUNT(rv.id)  AS review_count
  FROM restaurants r
  LEFT JOIN reviews rv ON rv.restaurant_id = r.restaurant_ID
  GROUP BY
    r.restaurant_ID,
    r.restaurantName,
    r.phone,
    r.address,
    r.website,
    r.tags,
    r.about,
    r.amenities,
    r.timeToVisit,
    r.notes,
    r.mondayHours,
    r.tuesdayHours,
    r.wednesdayHours,
    r.thursdayHours,
    r.fridayHours,
    r.saturdayHours,
    r.sundayHours
  ORDER BY r.restaurantName ASC
`);

    if (restaurants.length === 0) {
      await connection.end();
      return res.status(200).json({ restaurants: [] });
    }

    // Fetch the first photo for each restaurant in one query
    const ids = restaurants.map(r => r.restaurant_ID);
    const placeholders = ids.map(() => "?").join(",");

    const [photoRows] = await connection.execute(
      `SELECT restaurant_id, MIN(id) AS first_photo_id, file_path
       FROM restaurant_photos
       WHERE restaurant_id IN (${placeholders})
       GROUP BY restaurant_id`,
      ids
    );

    // Build a quick lookup map: restaurantId -> first photo URL
    const photoMap = {};
    photoRows.forEach(p => { photoMap[p.restaurant_id] = p.file_path; });

    // Attach the first photo URL to each restaurant
    const enriched = restaurants.map(r => ({
      ...r,
      photos: photoMap[r.restaurant_ID] ? [photoMap[r.restaurant_ID]] : []
    }));

    await connection.end();
    res.status(200).json({ restaurants: enriched });

  } catch (error) {
    console.error("Error fetching restaurants:", error);
    res.status(500).json({ message: "Server error while fetching restaurants" });
  }
});

//route: get restaurant information
app.get("/api/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await createConnection();

    const [restaurantRows] = await connection.execute(
      `
        SELECT
            r.restaurant_ID,
            r.restaurantName,
            r.phone,
            r.address,
            r.website,
            r.tags,
            r.about,
            r.amenities,
            r.timeToVisit,
            r.notes,
            r.mondayHours,
            r.tuesdayHours,
            r.wednesdayHours,
            r.thursdayHours,
            r.fridayHours,
            r.saturdayHours,
            r.sundayHours,
            r.email,
            u.first_name,
            u.last_name
        FROM restaurants r
        LEFT JOIN users u ON r.email = u.email
        WHERE r.restaurant_ID = ?
      `,
      [id]
    );

    if (restaurantRows.length === 0) {
      await connection.end();
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const [photoRows] = await connection.execute(
      `
      SELECT file_path
      FROM restaurant_photos
      WHERE restaurant_id = ?
      `,
      [id]
    );

    await connection.end();

    res.status(200).json({
      restaurant: {
        ...restaurantRows[0],
        photos: photoRows.map(row => row.file_path)
      }
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error while loading restaurant"
    });
  }
});

//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////


//////////////////////////////////////////////////
//ROUTES TO POST,GET,DELETE Reviews
/////////////////////////////////////////////////

// Route: POST /api/reviews — submit a new review with optional Cloudinary photo upload
app.post('/api/reviews', authenticateToken, uploadReview.array('photos', 6), async (req, res) => {
    try {
        let data;
        try {
            data = JSON.parse(req.body.data);
        } catch {
            return res.status(400).json({ message: 'Invalid review data.' });
        }

        const { restaurantId, sentiment, stars, notes, favoriteDishes, visitDate } = data;

        if (!restaurantId) {
            return res.status(400).json({ message: 'restaurantId is required.' });
        }

        const validSentiments = ['liked', 'fine', 'didnt'];
        if (sentiment && !validSentiments.includes(sentiment)) {
            return res.status(400).json({ message: 'Invalid sentiment value.' });
        }

        if (stars !== null && stars !== undefined) {
            const s = parseInt(stars);
            if (isNaN(s) || s < 1 || s > 5) {
                return res.status(400).json({ message: 'Stars must be between 1 and 5.' });
            }
        }

        const connection = await createConnection();

        const [result] = await connection.execute(
            `INSERT INTO reviews
             (restaurant_id, user_email, sentiment, stars, notes, favorite_dishes, visit_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                restaurantId,
                req.user.email,
                sentiment    || null,
                stars        || null,
                notes        || null,
                Array.isArray(favoriteDishes) ? favoriteDishes.join(', ') : (favoriteDishes || null),
                visitDate    || null
            ]
        );

        const reviewId = result.insertId;

        // Insert Cloudinary URLs into review_photos
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                await connection.execute(
                    'INSERT INTO review_photos (review_id, file_path) VALUES (?, ?)',
                    [reviewId, file.path]
                );
            }
        }

        await connection.end();

        res.status(201).json({
            message: 'Review submitted successfully.',
            reviewId
        });

    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ message: 'Error submitting review.' });
    }
});


// Route: GET /api/reviews/:restaurantId — get all reviews for a restaurant
app.get('/api/reviews/:restaurantId', async (req, res) => {
    try {
        const { restaurantId } = req.params;

        const connection = await createConnection();

        const [reviews] = await connection.execute(
            `SELECT
                r.id,
                r.sentiment,
                r.stars,
                r.notes,
                r.favorite_dishes,
                r.visit_date,
                r.created_at,
                u.username,
                u.first_name,
                u.last_name,
                u.profile_photo
             FROM reviews r
             JOIN users u ON r.user_email = u.email
             WHERE r.restaurant_id = ?
             ORDER BY r.created_at DESC`,
            [restaurantId]
        );

        const reviewIds = reviews.map(r => r.id);
        let photoMap = {};

        if (reviewIds.length > 0) {
            const placeholders = reviewIds.map(() => '?').join(',');
            const [photos] = await connection.execute(
                `SELECT review_id, file_path FROM review_photos WHERE review_id IN (${placeholders})`,
                reviewIds
            );
            photos.forEach(p => {
                if (!photoMap[p.review_id]) photoMap[p.review_id] = [];
                photoMap[p.review_id].push(p.file_path);
            });
        }

        await connection.end();

        const enriched = reviews.map(r => ({
            ...r,
            photos: photoMap[r.id] || [],
            initials: ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || r.username?.slice(0, 2).toUpperCase() || '?',
            profile_photo: r.profile_photo || null
        }));

        res.status(200).json({ reviews: enriched });

    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ message: 'Error fetching reviews.' });
    }
});


// Route: DELETE /api/reviews/:reviewId — delete own review + Cloudinary photos
app.delete('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const connection = await createConnection();

        const [rows] = await connection.execute(
            'SELECT id, user_email FROM reviews WHERE id = ?',
            [reviewId]
        );

        if (rows.length === 0) {
            await connection.end();
            return res.status(404).json({ message: 'Review not found.' });
        }

        if (rows[0].user_email !== req.user.email) {
            await connection.end();
            return res.status(403).json({ message: 'You can only delete your own reviews.' });
        }

        const [photos] = await connection.execute(
            'SELECT file_path FROM review_photos WHERE review_id = ?',
            [reviewId]
        );

        // Delete review from DB (cascade removes review_photos rows too)
        await connection.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);
        await connection.end();

        // Delete photos from Cloudinary
        for (const p of photos) {
            const publicId = p.file_path.split('/').slice(-2).join('/').replace(/\.[^/.]+$/, '');
            await cloudinary.uploader.destroy(publicId).catch(err =>
                console.warn('Could not delete from Cloudinary:', err)
            );
        }

        res.status(200).json({ message: 'Review deleted.' });

    } catch (error) {
        console.error('Error deleting review:', error);
        res.status(500).json({ message: 'Error deleting review.' });
    }
});  // ← ADD THIS to close the delete route

// Route: GET /api/reviews — get ALL recent reviews for the home feed
app.get('/api/reviews', async (req, res) => {
    try {
        const connection = await createConnection();

        const [reviews] = await connection.execute(
            `SELECT
                r.id,
                r.restaurant_id,
                r.sentiment,
                r.stars,
                r.notes,
                r.favorite_dishes,
                r.visit_date,
                r.created_at,
                u.username,
                u.first_name,
                u.last_name,
                u.profile_photo,
                res.restaurantName AS restaurant_name
             FROM reviews r
             JOIN users u ON r.user_email = u.email
             JOIN restaurants res ON r.restaurant_id = res.restaurant_ID
             ORDER BY r.created_at DESC
             LIMIT 50`
        );

        const reviewIds = reviews.map(r => r.id);
        let photoMap = {};

        if (reviewIds.length > 0) {
            const placeholders = reviewIds.map(() => '?').join(',');
            const [photos] = await connection.execute(
                `SELECT review_id, file_path FROM review_photos WHERE review_id IN (${placeholders})`,
                reviewIds
            );
            photos.forEach(p => {
                if (!photoMap[p.review_id]) photoMap[p.review_id] = [];
                photoMap[p.review_id].push(p.file_path);
            });
        }

        await connection.end();

        const enriched = reviews.map(r => ({
            ...r,
            photos: photoMap[r.id] || [],
            initials: ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || r.username?.slice(0, 2).toUpperCase() || '?',
            profile_photo: r.profile_photo || null
        }));

        res.status(200).json({ reviews: enriched });

    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({ message: 'Error fetching feed.' });
    }    
});

//////////////////////////////////////////////////
//END ROUTES TO POST,GET,DELETE Reviews
/////////////////////////////////////////////////

// Route: GET /api/my-reviews — all reviews for the authenticated user
app.get('/api/my-reviews', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();

        const [reviews] = await connection.execute(
            `SELECT
                r.id,
                r.restaurant_id,
                r.sentiment,
                r.stars,
                r.notes,
                r.favorite_dishes,
                r.visit_date,
                r.created_at,
                res.restaurantName AS restaurant_name
             FROM reviews r
             JOIN restaurants res ON r.restaurant_id = res.restaurant_ID
             WHERE r.user_email = ?
             ORDER BY r.created_at DESC`,
            [req.user.email]
        );

        const reviewIds = reviews.map(r => r.id);
        let photoMap = {};

        if (reviewIds.length > 0) {
            const placeholders = reviewIds.map(() => '?').join(',');
            const [photos] = await connection.execute(
                `SELECT review_id, file_path FROM review_photos WHERE review_id IN (${placeholders})`,
                reviewIds
            );
            photos.forEach(p => {
                if (!photoMap[p.review_id]) photoMap[p.review_id] = [];
                photoMap[p.review_id].push(p.file_path);
            });
        }

        await connection.end();

        res.status(200).json({
            reviews: reviews.map(r => ({ ...r, photos: photoMap[r.id] || [] }))
        });

    } catch (error) {
        console.error('Error fetching user reviews:', error);
        res.status(500).json({ message: 'Error fetching reviews.' });
    }
});

// Route: GET /api/leaderboard — users ranked by review count
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT u.email, u.username, u.first_name, u.last_name, u.profile_photo,
                    COUNT(r.id) AS review_count
             FROM users u
             LEFT JOIN reviews r ON r.user_email = u.email
             LEFT JOIN restaurants res ON r.restaurant_id = res.restaurant_ID
             WHERE r.id IS NULL OR res.restaurant_ID IS NOT NULL
             GROUP BY u.email
             ORDER BY review_count DESC, u.username ASC`
        );
        await connection.end();

        const leaderboard = rows.map((row, i) => ({
            rank: i + 1,
            username: row.username,
            first_name: row.first_name,
            last_name: row.last_name,
            profile_photo: row.profile_photo,
            review_count: row.review_count,
            isMe: row.email === req.user.email
        }));

        res.status(200).json({ leaderboard });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Error fetching leaderboard.' });
    }
});

// Route: GET /api/recommendations — 3 random restaurants user hasn't reviewed
app.get('/api/recommendations', authenticateToken, async (req, res) => {
    try {
        const connection = await createConnection();
        const [rows] = await connection.execute(
            `SELECT res.restaurant_ID AS id, res.restaurantName, res.tags,
                    (SELECT file_path FROM restaurant_photos rp
                     WHERE rp.restaurant_id = res.restaurant_ID LIMIT 1) AS photo
             FROM restaurants res
             WHERE res.restaurant_ID NOT IN (
                 SELECT restaurant_id FROM reviews WHERE user_email = ?
             )
             ORDER BY RAND()
             LIMIT 3`,
            [req.user.email]
        );
        await connection.end();
        res.status(200).json({ recommendations: rows });
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ message: 'Error fetching recommendations.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});