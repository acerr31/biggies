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