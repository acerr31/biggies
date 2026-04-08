// public/js/profile.js
function showShareToast(message) {
    let toast = document.getElementById("share-toast");

    if (!toast) {
        toast = document.createElement("div");
        toast.id = "share-toast";
        toast.className = "share-toast";
        document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(showShareToast.hideTimeout);
    showShareToast.hideTimeout = setTimeout(() => {
        toast.classList.remove("show");
    }, 2200);
}

async function copyProfileInvite(username) {
    const inviteText = `Join me on Plated! @${username}`;

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(inviteText);
        } else {
            await navigator.clipboard.writeText(inviteText);
        }

        showShareToast(`Copied: ${inviteText}`);
    } catch (error) {
        console.error("Error copying invite text:", error);
        showShareToast("Could not copy profile message.");
    }
}

function setAvatarPhoto(url) {
    const circle = document.getElementById("avatar-initials");
    const img    = document.getElementById("avatar-photo");
    if (!circle || !img) return;
    img.src = url;
    img.style.display = "block";
    // Hide the initials text without removing the img/input children
    Array.from(circle.childNodes)
        .filter(n => n.nodeType === Node.TEXT_NODE)
        .forEach(n => n.textContent = "");

    // Update topbar avatar
    const topbar = document.getElementById("topbar-initials");
    if (topbar) {
        topbar.style.backgroundImage = `url('${url}')`;
        topbar.style.backgroundSize = "cover";
        topbar.style.backgroundPosition = "center";
        topbar.textContent = "";
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    console.log("Profile page loaded");

    const token     = localStorage.getItem("jwtToken");
    const shareBtn  = document.getElementById("share-profile-btn");
    const circle    = document.getElementById("avatar-initials");
    const fileInput = document.getElementById("avatar-upload");

    // Click avatar → open file picker
    circle?.addEventListener("click", () => fileInput?.click());

    // File chosen → upload
    fileInput?.addEventListener("change", async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("photo", file);

        circle.classList.add("avatar-uploading");
        try {
            const res  = await fetch("/api/profile/photo", {
                method: "POST",
                headers: { "Authorization": token },
                body: formData
            });
            const data = await res.json();
            if (res.ok) {
                setAvatarPhoto(data.profile_photo);
            } else {
                document.getElementById("message").textContent = data.message || "Upload failed.";
            }
        } catch (err) {
            console.error("Photo upload error:", err);
            document.getElementById("message").textContent = "Upload error.";
        } finally {
            circle.classList.remove("avatar-uploading");
            fileInput.value = "";
        }
    });

    // If no token, redirect to login
    if (!token) {
        console.log("No token found — redirecting to login");
        window.location.href = "/";
        return;
    }

    try {
        const response = await fetch("/api/profile", {
            method: "GET",
            headers: {
                // IMPORTANT: Send RAW token (NO Bearer)
                "Authorization": token,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        console.log("Profile response:", data);

        if (!response.ok) {
            document.getElementById("message").textContent =
                data.message || "Failed to load profile.";
            return;
        }

        // Populate fields
        document.getElementById("profile-email").textContent =
            data.email || "—";

        document.getElementById("profile-username").textContent =
            data.username || "—";

        document.getElementById("profile-first-name").textContent =
            data.first_name || "—";

        document.getElementById("profile-last-name").textContent =
            data.last_name || "—";

        // Avatar initials (shown when no photo)
        const fn = data.first_name || "";
        const ln = data.last_name  || "";

        // Identity card display name + handle
        const displayName = document.getElementById("display-name");
        const handleSpan  = document.getElementById("handle-username");
        if (displayName) displayName.textContent = (fn && ln) ? `${fn} ${ln}` : data.username || "—";
        if (handleSpan)  handleSpan.textContent  = data.username || "—";
        const initials = ((fn[0] || "") + (ln[0] || "")).toUpperCase() || "?";
        const avatarEl = document.getElementById("avatar-initials");
        if (avatarEl) {
            let textNode = Array.from(avatarEl.childNodes)
                .find(n => n.nodeType === Node.TEXT_NODE);
            if (textNode) textNode.textContent = initials;
            else avatarEl.insertBefore(document.createTextNode(initials), avatarEl.firstChild);
        }
        const topbar = document.getElementById("topbar-initials");
        if (topbar) topbar.textContent = initials;

        // phone format
        if (data.phone_number) {
            const digits = data.phone_number.replace(/\D/g, "");

            if (digits.length === 10) {
                document.getElementById("profile-phone").textContent =
                    `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
            } else {
                document.getElementById("profile-phone").textContent = digits;
            }
        } else {
            document.getElementById("profile-phone").textContent = "—";
        }
        // Show profile photo if one exists
        if (data.profile_photo) {
            setAvatarPhoto(data.profile_photo);
        }

        // ── Fetch leaderboard (to show rank number immediately) ─
        try {
            const lbRes = await fetch("/api/leaderboard", {
                headers: { "Authorization": token }
            });
            if (lbRes.ok) {
                const { leaderboard } = await lbRes.json();
                const me = leaderboard.find(u => u.isMe);
                if (me) {
                    const rankEl = document.getElementById("rank-num");
                    if (rankEl) rankEl.textContent = `#${me.rank}`;
                    const summaryRank = document.getElementById("summary-rank");
                    if (summaryRank) summaryRank.textContent = `#${me.rank}`;
                }
                // Cache it so the dropdown doesn't re-fetch
                const dropdown = document.getElementById("leaderboard-dropdown");
                if (dropdown) {
                    dropdown.dataset.cache = JSON.stringify(leaderboard);
                }
            }
        } catch (e) {
            console.error("Could not load leaderboard:", e);
        }

        // ── Fetch recommendations ─────────────────────────────
        try {
            const recRes = await fetch("/api/recommendations", {
                headers: { "Authorization": token }
            });
            if (recRes.ok) {
                const { recommendations } = await recRes.json();
                renderRecommendations(recommendations);
            }
        } catch (e) {
            console.error("Could not load recommendations:", e);
        }

        // ── Fetch + render reviews (Been, streak, posts) ──────
        try {
            const revRes = await fetch("/api/my-reviews", {
                headers: { "Authorization": token }
            });
            if (revRes.ok) {
                const { reviews } = await revRes.json();
                updateReviewFeatures(reviews);
            }
        } catch (e) {
            console.error("Could not load reviews:", e);
        }

        if (shareBtn) {
            shareBtn.addEventListener("click", async () => {
            const username = (document.getElementById("profile-username")?.textContent || "").trim();

        if (!username || username === "—") {
            showShareToast("Username unavailable to share.");
            return;
        }

        await copyProfileInvite(username);
    });
}

    } catch (error) {
        console.error("Error loading profile:", error);
        document.getElementById("message").textContent =
            "Server connection error.";
    }
});

const editBtn = document.getElementById("edit-profile-btn");
if (editBtn) {
  editBtn.addEventListener("click", () => {
    window.location.href = "/edit-profile";
  });
}

const logoutBtn = document.getElementById("logout-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("jwtToken");
    window.location.href = "/";
  });
}

// ── Rank toggle + leaderboard ─────────────────────────────────
document.getElementById("rank-toggle")?.addEventListener("click", async () => {
    const dropdown = document.getElementById("leaderboard-dropdown");
    const chevron  = document.querySelector(".rank-chevron");
    if (!dropdown) return;

    const open = dropdown.classList.toggle("leaderboard-open");
    if (chevron) chevron.textContent = open ? "˅" : "›";

    if (open && !dropdown.dataset.rendered) {
        dropdown.dataset.rendered = "1";
        if (dropdown.dataset.cache) {
            renderLeaderboard(JSON.parse(dropdown.dataset.cache));
        } else {
            dropdown.innerHTML = `<p class="lb-loading">Loading...</p>`;
            const token = localStorage.getItem("jwtToken");
            try {
                const res  = await fetch("/api/leaderboard", { headers: { "Authorization": token } });
                const data = await res.json();
                renderLeaderboard(data.leaderboard);
            } catch {
                dropdown.innerHTML = `<p class="lb-loading">Could not load leaderboard.</p>`;
            }
        }
    }
});

function renderLeaderboard(leaderboard) {
    const dropdown = document.getElementById("leaderboard-dropdown");
    if (!dropdown) return;

    const medals = ["🥇", "🥈", "🥉"];
    dropdown.innerHTML = leaderboard.map(u => {
        const medal  = medals[u.rank - 1] || "";
        const name   = (u.first_name && u.last_name) ? `${u.first_name} ${u.last_name}` : u.username;
        const avatar = u.profile_photo
            ? `<img src="${u.profile_photo}" class="lb-avatar-img" />`
            : `<span class="lb-avatar-initials">${((u.first_name?.[0] || "") + (u.last_name?.[0] || "")).toUpperCase() || "?"}</span>`;
        return `
        <div class="lb-row${u.isMe ? " lb-me" : ""}">
          <span class="lb-rank">${medal || "#" + u.rank}</span>
          <div class="lb-avatar">${avatar}</div>
          <span class="lb-name">${escHtml(name)}</span>
          <span class="lb-count">${u.review_count} review${u.review_count !== 1 ? "s" : ""}</span>
        </div>`;
    }).join("");

    // Update rank number in card
    const me = leaderboard.find(u => u.isMe);
    if (me) {
        const rankEl = document.getElementById("rank-num");
        if (rankEl) rankEl.textContent = `#${me.rank}`;
    }
}

// ── Been toggle ───────────────────────────────────────────────
document.getElementById("been-toggle")?.addEventListener("click", () => {
    const dropdown = document.getElementById("been-dropdown");
    const chevron  = document.querySelector(".been-chevron");
    if (!dropdown) return;
    const open = dropdown.classList.toggle("been-open");
    if (chevron) chevron.textContent = open ? "˅" : "›";
});

// ── Review feature helpers ────────────────────────────────────

function updateReviewFeatures(reviews) {
    const count = reviews.length;

    // Visited count + been count
    const visitedEl = document.getElementById("visited-count");
    const beenCount = document.getElementById("been-list-count");
    if (visitedEl) visitedEl.textContent = count;
    if (beenCount) beenCount.innerHTML = `${count} <span class="been-chevron">›</span>`;

    // Streak
    const streak = calcStreak(reviews);
    const streakEl = document.getElementById("streak-count");
    if (streakEl) streakEl.textContent = `${streak} wk${streak !== 1 ? "s" : ""}`;

    // Summary stats in lists card
    const summaryVisited = document.getElementById("summary-visited");
    const summaryStreak  = document.getElementById("summary-streak");
    if (summaryVisited) summaryVisited.textContent = count;
    if (summaryStreak)  summaryStreak.textContent  = `${streak} wk${streak !== 1 ? "s" : ""}`;

    // Activity tip
    const tipEl = document.getElementById("activity-tip");
    if (tipEl) {
        if (count === 0) tipEl.textContent = "You haven't reviewed anywhere yet. Go explore!";
        else if (streak === 0) tipEl.textContent = "Post a review this week to start your streak!";
        else if (streak < 3) tipEl.textContent = `${streak} week streak — keep it going!`;
        else tipEl.textContent = `${streak} week streak! You're on a roll 🔥`;
    }

    // Been dropdown
    renderBeenDropdown(reviews);

    // Posts grid
    if (count > 0) {
        const postsLabel = document.getElementById("posts-count-label");
        if (postsLabel) postsLabel.textContent = `${count} post${count !== 1 ? "s" : ""}`;
        renderPostsGrid(reviews);
        document.getElementById("posts-section").style.display = "";
    }
}

function calcStreak(reviews) {
    if (!reviews.length) return 0;
    const MS_WEEK = 7 * 24 * 60 * 60 * 1000;

    // Get Monday-based week start timestamp for a date
    const weekStart = (d) => {
        const date = new Date(d);
        date.setHours(0, 0, 0, 0);
        const day = date.getDay();
        date.setDate(date.getDate() - (day === 0 ? 6 : day - 1));
        return date.getTime();
    };

    const weeks = new Set(reviews.map(r => weekStart(r.created_at)));
    const thisWeek = weekStart(new Date());
    const lastWeek = thisWeek - MS_WEEK;

    // Start from this week if it has a review, else last week
    let current = weeks.has(thisWeek) ? thisWeek : (weeks.has(lastWeek) ? lastWeek : null);
    if (!current) return 0;

    let streak = 0;
    while (weeks.has(current)) {
        streak++;
        current -= MS_WEEK;
    }
    return streak;
}

const SENT_LABEL = { liked: "Liked it", fine: "It was fine", didnt: "Didn't like it" };
const SENT_CLASS = { liked: "sent-liked", fine: "sent-fine", didnt: "sent-didnt" };

function renderBeenDropdown(reviews) {
    const dropdown = document.getElementById("been-dropdown");
    if (!dropdown) return;
    if (!reviews.length) {
        dropdown.innerHTML = `<p class="been-empty">No reviews yet.</p>`;
        return;
    }
    dropdown.innerHTML = reviews.map(r => {
        const sentClass = SENT_CLASS[r.sentiment] || "";
        const sentLabel = SENT_LABEL[r.sentiment] || "";
        const stars = r.stars ? "★".repeat(r.stars) + "☆".repeat(5 - r.stars) : "";
        return `
        <a href="restaurant.html?id=${r.restaurant_id}" class="been-item">
          <span class="been-restaurant">${escHtml(r.restaurant_name)}</span>
          <div class="been-item-right">
            ${sentLabel ? `<span class="been-badge ${sentClass}">${sentLabel}</span>` : ""}
            ${stars    ? `<span class="been-stars">${stars}</span>` : ""}
          </div>
        </a>`;
    }).join("");
}

function renderPostsGrid(reviews) {
    const grid = document.getElementById("posts-grid");
    if (!grid) return;

    grid.innerHTML = reviews.map(r => {
        const stars = r.stars ? "★".repeat(r.stars) + "☆".repeat(5 - r.stars) : "";
        const sentLabel = SENT_LABEL[r.sentiment] || "";
        const sentClass = SENT_CLASS[r.sentiment] || "";
        const date = r.visit_date || r.created_at
            ? new Date(r.visit_date || r.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
            : "";

        const photosHtml = r.photos?.length
            ? `<div class="pf-photos">
                ${r.photos.map(p => `<img src="${p}" alt="" class="pf-photo" />`).join("")}
               </div>`
            : "";

        return `
        <article class="pf-post">
          <div class="pf-header">
            <a href="restaurant.html?id=${r.restaurant_id}" class="pf-title">
              You ranked <strong>${escHtml(r.restaurant_name)}</strong>
            </a>
            <div class="pf-meta">
              ${sentLabel ? `<span class="pf-sentiment ${sentClass}">${sentLabel}</span>` : ""}
              ${stars ? `<span class="pf-stars">${stars}</span>` : ""}
              ${date ? `<span class="pf-date">${date}</span>` : ""}
            </div>
          </div>
          ${photosHtml}
          ${r.notes ? `<p class="pf-notes">${escHtml(r.notes)}</p>` : ""}
          ${r.favorite_dishes ? `<p class="pf-dishes">Favorites: ${escHtml(r.favorite_dishes)}</p>` : ""}
        </article>`;
    }).join("");
}

function openReviewModal(r) {
    // Photo strip
    const strip = document.getElementById("modal-photo-strip");
    strip.innerHTML = r.photos?.length
        ? r.photos.map(p => `<img src="${p}" alt="" class="modal-photo" />`).join("")
        : "";
    strip.style.display = r.photos?.length ? "flex" : "none";

    // Restaurant name + link
    document.getElementById("modal-restaurant").textContent = r.restaurant_name;
    const link = document.getElementById("modal-link");
    link.href = `restaurant.html?id=${r.restaurant_id}`;

    // Sentiment
    const sentEl = document.getElementById("modal-sentiment");
    sentEl.textContent = SENT_LABEL[r.sentiment] || "";
    sentEl.className = "modal-sentiment " + (SENT_CLASS[r.sentiment] || "");

    // Stars
    document.getElementById("modal-stars").textContent =
        r.stars ? "★".repeat(r.stars) + "☆".repeat(5 - r.stars) : "";

    // Date
    const dateEl = document.getElementById("modal-date");
    const raw = r.visit_date || r.created_at;
    dateEl.textContent = raw
        ? new Date(raw).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "";

    // Notes
    const notesEl = document.getElementById("modal-notes");
    notesEl.textContent = r.notes || "";
    notesEl.style.display = r.notes ? "" : "none";

    // Dishes
    const dishesEl = document.getElementById("modal-dishes");
    dishesEl.textContent = r.favorite_dishes ? `Favorites: ${r.favorite_dishes}` : "";
    dishesEl.style.display = r.favorite_dishes ? "" : "none";

    document.getElementById("review-modal-backdrop").classList.add("modal-open");
    document.body.style.overflow = "hidden";
}

// Close modal
document.addEventListener("DOMContentLoaded", () => {
    const backdrop = document.getElementById("review-modal-backdrop");
    document.getElementById("modal-close")?.addEventListener("click", closeModal);
    backdrop?.addEventListener("click", e => { if (e.target === backdrop) closeModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
});

function closeModal() {
    document.getElementById("review-modal-backdrop")?.classList.remove("modal-open");
    document.body.style.overflow = "";
}

function renderRecommendations(recs) {
    const list = document.getElementById("recs-list");
    if (!list) return;
    if (!recs.length) {
        list.innerHTML = `<p class="recs-empty">You've reviewed everything! Check back later.</p>`;
        return;
    }
    list.innerHTML = recs.map(r => {
        const photo = r.photo
            ? `<div class="rec-photo" style="background-image:url('${r.photo}')"></div>`
            : `<div class="rec-photo rec-photo-placeholder"></div>`;
        return `
        <a href="restaurant.html?id=${r.id}" class="rec-item">
          ${photo}
          <div class="rec-info">
            <span class="rec-name">${escHtml(r.restaurantName)}</span>
            ${r.tags ? `<span class="rec-tags">${escHtml(r.tags)}</span>` : ""}
          </div>
        </a>`;
    }).join("");
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}