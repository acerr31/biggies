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

        const visitDateVal = r.visit_date ? r.visit_date.split("T")[0] : "";

        return `
        <article class="pf-post" data-review-id="${r.id}" data-photos="${encodeURIComponent(JSON.stringify(r.photos || []))}">
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
          <div class="pf-actions">
            <button class="pf-edit-btn"
              data-id="${r.id}"
              data-sentiment="${r.sentiment || ""}"
              data-stars="${r.stars || ""}"
              data-notes="${escHtml(r.notes || "")}"
              data-dishes="${escHtml(r.favorite_dishes || "")}"
              data-visit-date="${visitDateVal}">Edit</button>
            <button class="pf-delete-btn" data-id="${r.id}">Delete</button>
          </div>
        </article>`;
    }).join("");

    // Store photos on the button element directly (not in dataset to avoid encoding issues)
    grid.querySelectorAll(".pf-edit-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const article = btn.closest("article");
            const photos  = article ? JSON.parse(decodeURIComponent(article.dataset.photos || "%5B%5D")) : [];
            openEditModal(btn.dataset, photos);
        });
    });
    grid.querySelectorAll(".pf-delete-btn").forEach(btn => {
        btn.addEventListener("click", () => deleteReview(btn.dataset.id));
    });
}

let _editPhotosToDelete = new Set();

async function deleteReview(id) {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    const token = localStorage.getItem("jwtToken");
    try {
        const res = await fetch(`/api/reviews/${id}`, {
            method: "DELETE",
            headers: { "Authorization": token }
        });
        if (!res.ok) throw new Error();
        document.querySelector(`.pf-post[data-review-id="${id}"]`)?.remove();
    } catch {
        alert("Could not delete review.");
    }
}

function openEditModal(data, photos) {
    _editPhotosToDelete = new Set();

    document.getElementById("edit-review-id").value  = data.id;
    document.getElementById("edit-sentiment").value  = data.sentiment || "";
    document.getElementById("edit-stars").value      = data.stars || "";
    document.getElementById("edit-notes").value      = (data.notes || "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');
    document.getElementById("edit-dishes").value     = (data.dishes || "").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"');
    document.getElementById("edit-visit-date").value = data.visitDate || "";
    document.getElementById("edit-error").style.display = "none";

    // Render current photos
    const photoContainer = document.getElementById("edit-current-photos");
    photoContainer.innerHTML = (photos && photos.length) ? photos.map(url => `
        <div class="edit-photo-thumb" data-url="${url}" style="position:relative;width:72px;height:72px;">
            <img src="${url}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;" />
            <button class="edit-photo-remove" data-url="${url}"
                style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#c0392b;color:#fff;border:none;cursor:pointer;font-size:.75rem;line-height:20px;text-align:center;padding:0;">✕</button>
        </div>`).join("") : "<p style='font-size:.82rem;color:#aaa;'>No photos</p>";

    photoContainer.querySelectorAll(".edit-photo-remove").forEach(btn => {
        btn.addEventListener("click", () => {
            _editPhotosToDelete.add(btn.dataset.url);
            btn.closest(".edit-photo-thumb").remove();
        });
    });

    // Clear new photo input + preview
    const newInput = document.getElementById("edit-new-photos");
    const preview  = document.getElementById("edit-new-photos-preview");
    if (newInput) newInput.value = "";
    if (preview)  preview.innerHTML = "";

    const backdrop = document.getElementById("edit-modal-backdrop");
    backdrop.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeEditModal() {
    document.getElementById("edit-modal-backdrop").style.display = "none";
    document.body.style.overflow = "";
}

async function saveEditReview() {
    const id        = document.getElementById("edit-review-id").value;
    const sentiment = document.getElementById("edit-sentiment").value;
    const stars     = document.getElementById("edit-stars").value;
    const notes     = document.getElementById("edit-notes").value.trim();
    const dishes    = document.getElementById("edit-dishes").value.trim();
    const visitDate = document.getElementById("edit-visit-date").value;
    const errEl     = document.getElementById("edit-error");
    const token     = localStorage.getItem("jwtToken");
    const newPhotos = document.getElementById("edit-new-photos")?.files || [];

    const fd = new FormData();
    fd.append("data", JSON.stringify({
        sentiment,
        stars: stars || null,
        notes,
        favoriteDishes: dishes,
        visitDate,
        photosToDelete: [..._editPhotosToDelete]
    }));
    for (const file of newPhotos) fd.append("photos", file);

    try {
        const res = await fetch(`/api/reviews/${id}`, {
            method: "PUT",
            headers: { "Authorization": token },
            body: fd
        });
        const data = await res.json();
        if (!res.ok) {
            errEl.textContent = data.message || "Could not save.";
            errEl.style.display = "block";
            return;
        }
        closeEditModal();
        const revRes = await fetch("/api/my-reviews", { headers: { "Authorization": token } });
        if (revRes.ok) {
            const { reviews } = await revRes.json();
            renderPostsGrid(reviews);
        }
    } catch {
        errEl.textContent = "Network error. Please try again.";
        errEl.style.display = "block";
    }
}

async function loadMyRestaurants() {
    const token = localStorage.getItem("jwtToken");
    try {
        const res = await fetch("/api/my-restaurants", { headers: { "Authorization": token } });
        if (!res.ok) return;
        const { restaurants } = await res.json();
        if (!restaurants.length) return;

        const section = document.getElementById("submissions-section");
        const list    = document.getElementById("submissions-list");
        const label   = document.getElementById("submissions-count-label");
        if (!section || !list) return;

        label.textContent = `${restaurants.length} submission${restaurants.length !== 1 ? "s" : ""}`;
        list.innerHTML = restaurants.map(r => `
          <div class="been-item" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f0ebe4;" data-restaurant-id="${r.restaurant_ID}">
            ${r.photo ? `<img src="${r.photo}" style="width:52px;height:52px;object-fit:cover;border-radius:8px;flex-shrink:0;" alt="" />` : `<div style="width:52px;height:52px;border-radius:8px;background:#f0ebe4;flex-shrink:0;"></div>`}
            <div style="flex:1;min-width:0;">
              <a href="restaurant.html?id=${r.restaurant_ID}" style="font-weight:600;color:#1f2937;text-decoration:none;font-size:.92rem;">${escHtml(r.restaurantName)}</a>
              ${r.address ? `<p style="font-size:.8rem;color:#8a8278;margin:2px 0 0;">${escHtml(r.address)}</p>` : ""}
            </div>
            <button class="sub-delete-btn" data-id="${r.restaurant_ID}" style="font-size:.78rem;color:#c0392b;padding:4px 10px;border-radius:999px;border:1px solid #fecaca;background:#fef2f2;cursor:pointer;flex-shrink:0;">Delete</button>
          </div>
        `).join("");

        list.querySelectorAll(".sub-delete-btn").forEach(btn => {
            btn.addEventListener("click", () => deleteRestaurant(btn.dataset.id));
        });

        section.style.display = "";
    } catch (e) {
        console.error("Could not load submissions:", e);
    }
}

async function deleteRestaurant(id) {
    if (!confirm("Delete this restaurant submission? This will also remove all its reviews.")) return;
    const token = localStorage.getItem("jwtToken");
    try {
        const res = await fetch(`/api/restaurants/${id}`, {
            method: "DELETE",
            headers: { "Authorization": token }
        });
        if (!res.ok) throw new Error();
        document.querySelector(`[data-restaurant-id="${id}"]`)?.remove();
    } catch {
        alert("Could not delete restaurant.");
    }
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

    const editBackdrop = document.getElementById("edit-modal-backdrop");
    document.getElementById("edit-modal-close")?.addEventListener("click", closeEditModal);
    editBackdrop?.addEventListener("click", e => { if (e.target === editBackdrop) closeEditModal(); });
    document.getElementById("edit-save-btn")?.addEventListener("click", saveEditReview);

    document.getElementById("edit-new-photos")?.addEventListener("change", function () {
        const preview = document.getElementById("edit-new-photos-preview");
        preview.innerHTML = "";
        for (const file of this.files) {
            const url = URL.createObjectURL(file);
            preview.innerHTML += `<img src="${url}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;" />`;
        }
    });

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") { closeModal(); closeEditModal(); }
    });

    loadMyRestaurants();
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