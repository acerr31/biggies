require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { access } = require('fs');
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const reviewUploadDir = path.join(__dirname, 'public', 'uploads', 'reviews');
if (!fs.existsSync(reviewUploadDir)) fs.mkdirSync(reviewUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, reviewUploadDir),
  filename:    (req, file, cb) => {
    const ext  = path.extname(file.originalname).toLowerCase();
    const name = `review_${Date.now()}_${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed.'));
    }
  }
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

            // Query the database to verify that the email is associated with an active account
            const [rows] = await connection.execute(
                'SELECT email FROM users WHERE email = ?',
                [decoded.email]
            );

            await connection.end();  // Close connection

            if (rows.length === 0) {
                return res.status(403).json({ message: 'Account not found or deactivated.' });
            }

            req.user = decoded;  // Save the decoded email for use in the route
            next();  // Proceed to the next middleware or route handler
        } catch (dbError) {
            console.error(dbError);
            res.status(500).json({ message: 'Database error during authentication.' });
        }
    });

    // Cookie Parser (reads cookies and turns them into strings to associate with a user session)
    const cookieParser = require('cookie-parser');
    app.use(cookieParser());

    // helper: in-memory refresh token store (demo only)
    const refreshTokens = new Map(); // key: refreshToken -> userId

    // issue tokens function
    function issueTokens(user) {
        const accessToken = jwt.sign({ userId: user.id, email: user.email}, process.env.JWT_SECRET, {expiresIn: '15m'})
        const refreshToken = require('crypto').randomBytes(40).toString('hex');
        refreshTokens.set(refreshToken, user.id);
        return { accessToken, refreshToken };
    }

    // refresh route
    app.post('/api/token/refresh', async (req, res) => {
        const token = req.cookies.refreshToken;
        if (!token || !refreshTokens.has(token)) return res.status(401).json({ message: 'Invalid refresh token' });
        const userId = refreshTokens.get(token);
        // optionally re-check user active in DB
        const connection = await createConnection();
        const [rows] = await connection.execute('SELECT id, email FROM users WHERE id = ?', [userId]);
        await connection.end();
        if (!rows.length) return res.status(401).json({ message: 'Invalid user'});
        const user = rows[0];
        const accessToken = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '15m'});
        res.json({ accessToken, expiresIn: '15m'});
    });

    // logout
    app.post('/api/logout', (req, res) => {
        const token = req.cookies.refreshToken;
        if (token) refreshTokens.delete(token);
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out' });
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
        const hashedPassword = await bcrypt.hash(password, 10);  // Hash password

        const [result] = await connection.execute(
            'INSERT INTO users (email, username, password, first_name, last_name, phone_number) VALUES (?, ?, ?, ?, ?, ?)',
            [email, username, hashedPassword, first_name, last_name, phone_number]
        );

        await connection.end();  // Close connection

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

// for profile page 
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

        await connection.end(); // Close connection

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

    // phone is optional, but if provided must be 10–15 digits
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

        // Return the updated profile (nice for frontend)
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
        // If username/phone are UNIQUE in DB, this catches duplicates
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

        await connection.end();  // Close connection

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

            res.sendFile(__dirname + '/public/logon.html');;

        await connection.end();  // Close connection

        const emailList = rows.map((row) => row.email);
        res.status(200).json({ emails: emailList });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error retrieving email addresses.' });
    }
});

//route: for restaurant submission form
app.post("/api/restaurants", async (req, res) => {
  try {
    const {
      restaurantName,
      phone,
      address,
      website,
      tags,
      about,
      amenities,
      timeToVisit,
      notes
    } = req.body;

    // basic validation
    if (!restaurantName || !phone || !address || !about || !tags) {
      return res.status(400).json({
        message: "Missing required fields"
      });
    }

    const connection = await createConnection();

    const sql = `
      INSERT INTO restaurants
      (restaurantName, phone, address, website, tags, about, amenities, timeToVisit, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      notes
    ];

    const [result] = await connection.execute(sql, values);

    await connection.end();

    res.status(201).json({
      message: "Restaurant submitted successfully",
      id: result.insertId
    });

  } catch (error) {
    res.status(500).json({
      message: "Server error while submitting restaurant"
    });
  }
});

//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////


//////////////////////////////////////////////////
//ROUTES TO POST,GET,DELETE Reviews
/////////////////////////////////////////////////

// Route: POST /api/reviews — submit a new review (with optional photos)
app.post('/api/reviews', authenticateToken, upload.array('photos', 6), async (req, res) => {
    try {
        // Parse the JSON payload sent alongside the FormData
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
 
        // Validate sentiment if provided
        const validSentiments = ['liked', 'fine', 'didnt'];
        if (sentiment && !validSentiments.includes(sentiment)) {
            return res.status(400).json({ message: 'Invalid sentiment value.' });
        }
 
        // Validate stars if provided
        if (stars !== null && stars !== undefined) {
            const s = parseInt(stars);
            if (isNaN(s) || s < 1 || s > 5) {
                return res.status(400).json({ message: 'Stars must be between 1 and 5.' });
            }
        }
 
        const connection = await createConnection();
 
        // Insert the review
        const [result] = await connection.execute(
            `INSERT INTO reviews
             (restaurant_id, user_email, sentiment, stars, notes, favorite_dishes, visit_date)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                restaurantId,
                req.user.email,
                sentiment   || null,
                stars       || null,
                notes       || null,
                Array.isArray(favoriteDishes) ? favoriteDishes.join(', ') : (favoriteDishes || null),
                visitDate   || null
            ]
        );
 
        const reviewId = result.insertId;
 
        // Insert photo paths if any files were uploaded
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const relativePath = `/uploads/reviews/${file.filename}`;
                await connection.execute(
                    'INSERT INTO review_photos (review_id, file_path) VALUES (?, ?)',
                    [reviewId, relativePath]
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
 
        // Fetch reviews joined with username and initials
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
 
        // Fetch photos for each review
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
 
        // Attach photos and computed initials to each review
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
 
 
// Route: DELETE /api/reviews/:reviewId — delete own review
app.delete('/api/reviews/:reviewId', authenticateToken, async (req, res) => {
    try {
        const { reviewId } = req.params;
        const connection = await createConnection();
 
        // Make sure the review belongs to the requesting user
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
 
        // Fetch photo paths so we can delete the files too
        const [photos] = await connection.execute(
            'SELECT file_path FROM review_photos WHERE review_id = ?',
            [reviewId]
        );
 
        // Delete from DB (cascade deletes review_photos rows too)
        await connection.execute('DELETE FROM reviews WHERE id = ?', [reviewId]);
        await connection.end();
 
        // Delete photo files from disk
        photos.forEach(p => {
            const fullPath = path.join(__dirname, 'public', p.file_path);
            fs.unlink(fullPath, err => { if (err) console.warn('Could not delete file:', fullPath); });
        });
 
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