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

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching profile.' });
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
      sundayHours
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
        sundayHours
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      sundayHours
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


//route: get restaurant information
app.get("/api/restaurants/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const connection = await createConnection();

    const [rows] = await connection.execute(
      `
      SELECT
        restaurant_ID,
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
        sundayHours
      FROM restaurants
      WHERE restaurant_ID = ?
      `,
      [id]
    );

    await connection.end();

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Restaurant not found"
      });
    }

    res.status(200).json({
      restaurant: rows[0]
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
                u.last_name
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
            initials: ((r.first_name?.[0] || '') + (r.last_name?.[0] || '')).toUpperCase() || r.username?.slice(0, 2).toUpperCase() || '?'
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
});

//////////////////////////////////////////////////
//END ROUTES TO POST,GET,DELETE Reviews
/////////////////////////////////////////////////

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});