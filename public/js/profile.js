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
            const tempInput = document.createElement("textarea");
            tempInput.value = inviteText;
            tempInput.setAttribute("readonly", "");
            tempInput.style.position = "absolute";
            tempInput.style.left = "-9999px";
            document.body.appendChild(tempInput);
            tempInput.select();
            document.execCommand("copy");
            document.body.removeChild(tempInput);
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
        <div class="been-item">
          <span class="been-restaurant">${escHtml(r.restaurant_name)}</span>
          <div class="been-item-right">
            ${sentLabel ? `<span class="been-badge ${sentClass}">${sentLabel}</span>` : ""}
            ${stars    ? `<span class="been-stars">${stars}</span>` : ""}
          </div>
        </div>`;
    }).join("");
}

function renderPostsGrid(reviews) {
    const grid = document.getElementById("posts-grid");
    if (!grid) return;
    grid.innerHTML = reviews.map(r => {
        const photo = r.photos?.[0];
        const initial = r.restaurant_name?.[0]?.toUpperCase() || "?";
        const stars = r.stars ? "★".repeat(r.stars) : "";
        const bg = photo
            ? `style="background-image:url('${photo}')"`
            : `class="post-cell-placeholder"`;
        return `
        <div class="post-cell" ${bg}>
          ${!photo ? `<span class="post-initial">${initial}</span>` : ""}
          <div class="post-overlay">
            <span class="post-name">${escHtml(r.restaurant_name)}</span>
            ${stars ? `<span class="post-stars">${stars}</span>` : ""}
          </div>
        </div>`;
    }).join("");
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}