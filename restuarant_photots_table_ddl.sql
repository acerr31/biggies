CREATE TABLE restaurant_photos (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id   INT          NOT NULL,
    file_path       VARCHAR(500) NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (restaurant_id) REFERENCES restaurants(restaurant_ID) ON DELETE CASCADE
);