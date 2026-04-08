// avatar.js — shared helpers for profile photo display

// Render an avatar element: photo if available, else initials
// Returns an HTML string
function avatarHtml(profilePhoto, initials, size = "md") {
    if (profilePhoto) {
        return `<img src="${profilePhoto}" alt="" class="avatar-img avatar-${size}" />`;
    }
    return `<span class="avatar-initials avatar-${size}">${escAvatarHtml(initials || "?")}</span>`;
}

function escAvatarHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// Load the current user's profile photo into the topbar avatar
async function loadTopbarAvatar() {
    const token = localStorage.getItem("jwtToken");
    if (!token) return;

    try {
        const res  = await fetch("/api/profile", {
            headers: { "Authorization": token }
        });
        if (!res.ok) return;
        const data = await res.json();

        // Support both ID conventions used across pages
        const topbarAvatar = document.getElementById("topbar-initials") || document.getElementById("topbarAvatar");
        if (!topbarAvatar) return;

        const fn = data.first_name || "";
        const ln = data.last_name  || "";
        const initials = ((fn[0] || "") + (ln[0] || "")).toUpperCase() || "?";

        if (data.profile_photo) {
            topbarAvatar.style.backgroundImage  = `url('${data.profile_photo}')`;
            topbarAvatar.style.backgroundSize   = "cover";
            topbarAvatar.style.backgroundPosition = "center";
            topbarAvatar.textContent = "";
        } else {
            topbarAvatar.textContent = initials;
        }

        // Also update topbar username if present
        const topbarUsername = document.getElementById("profile-username");
        if (topbarUsername) topbarUsername.textContent = data.username || "";

    } catch (e) {
        console.error("Could not load topbar avatar:", e);
    }
}
