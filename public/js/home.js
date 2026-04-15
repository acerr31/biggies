// public/js/home.js

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("jwtToken");

    // If no token, redirect to login
    if (!token) {
        window.location.href = "/";
        return;
    }
});

// ── Likes ────────────────────────────────────────────────────

/**
 * Toggle a like on a review.
 * Updates the button's count and filled/unfilled state immediately.
 */
async function toggleLike(reviewId, btnEl) {
    const token = localStorage.getItem("jwtToken");
    if (!token) return;

    // Optimistic UI: disable while request is in flight
    btnEl.disabled = true;

    try {
        const res  = await fetch(`/api/reviews/${reviewId}/like`, {
            method:  "POST",
            headers: { "Authorization": token }
        });
        const data = await res.json();

        if (res.ok) {
            const countEl = btnEl.querySelector(".like-count");
            countEl.textContent = data.total;
            btnEl.classList.toggle("liked", data.liked);
            btnEl.setAttribute("aria-pressed", String(data.liked));
        }
    } catch (err) {
        console.error("Like error:", err);
    } finally {
        btnEl.disabled = false;
    }
}

// ── Comments ─────────────────────────────────────────────────

/**
 * Build a single comment node from a comment object.
 */
function buildCommentEl(c) {
    const timeStr = new Date(c.created_at).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric"
    });

    const div = document.createElement("div");
    div.className = "comment-item";
    div.innerHTML = `
        ${c.profile_photo
            ? `<img src="${c.profile_photo}" class="avatar avatar-photo comment-avatar" alt="" />`
            : `<div class="avatar comment-avatar" style="background:#d4872a;">${c.initials}</div>`
        }
        <div class="comment-content">
            <span class="comment-author">${c.username}</span>
            <span class="comment-time">${timeStr}</span>
            <p class="comment-body">${c.body}</p>
        </div>
    `;
    return div;
}

/**
 * Load and render all comments for a given review into its container.
 */
async function loadComments(reviewId, listEl) {
    listEl.innerHTML = `<p class="comments-loading">Loading comments…</p>`;

    try {
        const res  = await fetch(`/api/reviews/${reviewId}/comments`);
        const data = await res.json();

        listEl.innerHTML = "";

        if (!data.comments || data.comments.length === 0) {
            listEl.innerHTML = `<p class="no-comments">No comments yet — be the first!</p>`;
            return;
        }

        data.comments.forEach(c => listEl.appendChild(buildCommentEl(c)));

    } catch (err) {
        console.error("Load comments error:", err);
        listEl.innerHTML = `<p class="no-comments">Could not load comments.</p>`;
    }
}

/**
 * Submit a new comment for a review.
 */
async function postComment(reviewId, textarea, listEl, countEl) {
    const token = localStorage.getItem("jwtToken");
    const body  = textarea.value.trim();
    if (!token || !body) return;

    textarea.disabled = true;

    try {
        const res  = await fetch(`/api/reviews/${reviewId}/comments`, {
            method:  "POST",
            headers: { "Authorization": token, "Content-Type": "application/json" },
            body:    JSON.stringify({ body })
        });
        const data = await res.json();

        if (res.ok) {
            textarea.value = "";
            // Remove the "no comments" placeholder if present
            const placeholder = listEl.querySelector(".no-comments");
            if (placeholder) placeholder.remove();
            // Append the new comment
            listEl.appendChild(buildCommentEl(data.comment));
            // Update the count badge in the toggle button
            if (countEl) {
                const current = parseInt(countEl.textContent, 10) || 0;
                countEl.textContent = current + 1;
            }
        }
    } catch (err) {
        console.error("Post comment error:", err);
    } finally {
        textarea.disabled = false;
        textarea.focus();
    }
}

// ── Event delegation for likes and comments ──────────────────
//
// We use a single delegated listener on document so it works even
// after the feed re-renders (tab switch, etc.).
//

document.addEventListener("click", async (e) => {

    // ── Like button ─────────────────────────────────────────
    const likeBtn = e.target.closest(".like-btn");
    if (likeBtn) {
        const reviewId = likeBtn.dataset.reviewId;
        if (reviewId) toggleLike(reviewId, likeBtn);
        return;
    }

    // ── Comment toggle button ───────────────────────────────
    const commentToggle = e.target.closest(".comment-toggle-btn");
    if (commentToggle) {
        const card      = commentToggle.closest(".card");
        const section   = card.querySelector(".comment-section");
        const listEl    = section.querySelector(".comment-list");
        const reviewId  = commentToggle.dataset.reviewId;

        const isOpen = section.classList.toggle("open");
        commentToggle.setAttribute("aria-expanded", String(isOpen));

        // Load comments the first time the section is opened
        if (isOpen && listEl.dataset.loaded !== "true") {
            listEl.dataset.loaded = "true";
            await loadComments(reviewId, listEl);
        }
        return;
    }

    // ── Submit comment button ───────────────────────────────
    const submitBtn = e.target.closest(".comment-submit-btn");
    if (submitBtn) {
        const card     = submitBtn.closest(".card");
        const reviewId = submitBtn.dataset.reviewId;
        const textarea = card.querySelector(".comment-input");
        const listEl   = card.querySelector(".comment-list");
        const countEl  = card.querySelector(".comment-count");
        await postComment(reviewId, textarea, listEl, countEl);
        return;
    }
});

// Allow Ctrl+Enter / Cmd+Enter to submit inside the textarea
document.addEventListener("keydown", async (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        const textarea  = e.target.closest(".comment-input");
        if (!textarea) return;
        const card      = textarea.closest(".card");
        const reviewId  = card.querySelector(".comment-submit-btn")?.dataset.reviewId;
        const listEl    = card.querySelector(".comment-list");
        const countEl   = card.querySelector(".comment-count");
        await postComment(reviewId, textarea, listEl, countEl);
    }
});

// ── Feed sidebar widgets ───────────────────────────────────

function escHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderStars(n) {
    const full = Math.round(Number(n) || 0);
    let out = "";
    for (let i = 1; i <= 5; i++) {
        out += i <= full ? "★" : "☆";
    }
    return out;
}

function getReviewDate(review) {
    return review.created_at || review.review_date || review.visit_date || null;
}

function isInCurrentWeek(dateStr) {
    if (!dateStr) return false;

    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return false;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - now.getDay());

    return date >= startOfWeek && date <= now;
}

function shuffleArray(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function initialsFromUser(user) {
    const first = (user.first_name || "").trim()[0] || "";
    const last = (user.last_name || "").trim()[0] || "";
    const username = (user.username || "").trim();
    return (first + last || username.slice(0, 2) || "?").toUpperCase();
}

async function loadHomeWeeklyTopRestaurants() {
    const container = document.getElementById("homeWeeklyTopRestaurants");
    if (!container) return;

    container.innerHTML = `<div class="weekly-top-empty">Loading weekly rankings...</div>`;

    try {
        const restaurantRes = await fetch("/api/restaurants");
        if (!restaurantRes.ok) throw new Error("Failed to load restaurants");

        const restaurantData = await restaurantRes.json();
        const restaurants = restaurantData.restaurants || [];

        if (!restaurants.length) {
            container.innerHTML = `<div class="weekly-top-empty">No restaurants found.</div>`;
            return;
        }

        const restaurantStats = await Promise.all(
            restaurants.map(async (restaurant) => {
                try {
                    const reviewRes = await fetch(`/api/reviews/${restaurant.restaurant_ID}`);
                    if (!reviewRes.ok) throw new Error("Failed reviews fetch");

                    const reviewData = await reviewRes.json();
                    const reviews = reviewData.reviews || [];

                    const weeklyReviews = reviews.filter((review) => {
                        const reviewDate = getReviewDate(review);
                        return isInCurrentWeek(reviewDate);
                    });

                    const ratingsThisWeek = weeklyReviews
                        .map((review) => Number(review.stars))
                        .filter((stars) => !Number.isNaN(stars) && stars > 0);

                    const avgRatingThisWeek = ratingsThisWeek.length
                        ? ratingsThisWeek.reduce((sum, stars) => sum + stars, 0) / ratingsThisWeek.length
                        : 0;

                    return {
                        restaurant_ID: restaurant.restaurant_ID,
                        restaurantName: restaurant.restaurantName,
                        reviewsThisWeek: weeklyReviews.length,
                        avgRatingThisWeek
                    };
                } catch (err) {
                    console.error(`Weekly stats failed for restaurant ${restaurant.restaurant_ID}`, err);
                    return {
                        restaurant_ID: restaurant.restaurant_ID,
                        restaurantName: restaurant.restaurantName,
                        reviewsThisWeek: 0,
                        avgRatingThisWeek: 0
                    };
                }
            })
        );

        const topRestaurants = restaurantStats
            .filter((restaurant) => restaurant.reviewsThisWeek > 0)
            .sort((a, b) => {
                if (b.reviewsThisWeek !== a.reviewsThisWeek) {
                    return b.reviewsThisWeek - a.reviewsThisWeek;
                }
                return b.avgRatingThisWeek - a.avgRatingThisWeek;
            })
            .slice(0, 5);

        if (!topRestaurants.length) {
            container.innerHTML = `<div class="weekly-top-empty">No reviews were added for restaurants this week.</div>`;
            return;
        }

        container.innerHTML = topRestaurants.map((restaurant, index) => `
            <div class="weekly-top-item">
                <div class="weekly-top-rank">#${index + 1}</div>
                <div class="weekly-top-content">
                    <a href="restaurant.html?id=${restaurant.restaurant_ID}" class="weekly-top-name">
                        ${escHtml(restaurant.restaurantName)}
                    </a>
                    <div class="weekly-top-meta">
                        <span>${restaurant.reviewsThisWeek} review${restaurant.reviewsThisWeek === 1 ? "" : "s"} this week</span>
                        <span>•</span>
                        <span>${renderStars(restaurant.avgRatingThisWeek)} (${restaurant.avgRatingThisWeek.toFixed(1)})</span>
                    </div>
                </div>
            </div>
        `).join("");
    } catch (err) {
        console.error(err);
        container.innerHTML = `<div class="weekly-top-empty">Could not load weekly top restaurants.</div>`;
    }
}

function emailToHandle(email) {
    const local = String(email || "").split("@")[0].trim();
    return local || "member";
}

function handleToInitials(handle) {
    const cleaned = String(handle || "").replace(/[^a-zA-Z0-9]/g, "");
    return (cleaned.slice(0, 2) || "?").toUpperCase();
}

async function loadSuggestedFollows() {
    const container = document.getElementById("suggestedFollowsList");
    if (!container) return;

    const token = localStorage.getItem("jwtToken");
    const headers = token
        ? { "Authorization": token, "Content-Type": "application/json" }
        : {};

    container.innerHTML = `<div class="weekly-top-empty">Loading suggestions...</div>`;

    try {
        const [profileRes, usersRes] = await Promise.all([
            fetch("/api/profile", {
                method: "GET",
                headers
            }),
            fetch("/api/users", {
                method: "GET",
                headers
            })
        ]);

        if (!usersRes.ok) throw new Error("Failed to load users");

        const profileData = profileRes.ok ? await profileRes.json() : {};
        const usersData = await usersRes.json();

        const currentEmail = String(profileData.email || "").toLowerCase().trim();

        const emails = Array.isArray(usersData.emails) ? usersData.emails : [];

        const suggestions = shuffleArray(
            emails.filter((email) => {
                const normalizedEmail = String(email || "").toLowerCase().trim();

                if (!normalizedEmail) return false;
                if (normalizedEmail === "poop@email.com") return false;
                if (normalizedEmail === currentEmail) return false;

                return true;
            })
        ).slice(0, 3);

        if (!suggestions.length) {
            container.innerHTML = `<div class="weekly-top-empty">No suggested follows right now.</div>`;
            return;
        }

        container.innerHTML = suggestions.map((email) => {
            const handle = emailToHandle(email);
            const initials = handleToInitials(handle);

            return `
                <div class="suggest-item">
                    <div class="avatar" style="background:#d4872a;">${escHtml(initials)}</div>
                    <div class="suggest-info">
                        <p>${escHtml(handle)}</p>
                        <p class="suggest-sub">Plated member</p>
                    </div>
                    <button class="follow-btn" type="button">Follow</button>
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Suggested follows error:", err);
        container.innerHTML = `<div class="weekly-top-empty">Could not load suggestions.</div>`;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadHomeWeeklyTopRestaurants();
    loadSuggestedFollows();
});