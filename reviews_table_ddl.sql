CREATE TABLE reviews (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    restaurant_id   INT           NOT NULL,
    user_email      VARCHAR(255)  NOT NULL,
    sentiment       ENUM('liked','fine','didnt') DEFAULT NULL,
    stars           TINYINT UNSIGNED DEFAULT NULL CHECK (stars BETWEEN 1 AND 5),
    notes           TEXT          DEFAULT NULL,
    favorite_dishes VARCHAR(500)  DEFAULT NULL,
    visit_date      DATE          DEFAULT NULL,
    created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (user_email) REFERENCES users(email) ON DELETE CASCADE
);

CREATE TABLE review_photos (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    review_id   INT          NOT NULL,
    file_path   VARCHAR(500) NOT NULL,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
);