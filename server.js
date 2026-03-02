require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { access } = require('fs');

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

    // Cookie Parser 
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
//////////////////////////////////////
//END ROUTES TO HANDLE API REQUESTS
//////////////////////////////////////


// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});