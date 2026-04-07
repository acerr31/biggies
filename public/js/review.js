// public/js/review.js
// Controller for the review page

(function () {
  "use strict";

  /* ── state ── */
  let selectedSentiment = null;
  let selectedStars     = 0;
  const dishes          = [];

  /* ── DOM refs ── */
  const sentimentBtns = document.querySelectorAll(".sentiment-btn");
  const starBtns      = document.querySelectorAll(".star-btn");
  const starsRow      = document.getElementById("starsRow");
  const notesEl       = document.getElementById("reviewNotes");
  const charCountEl   = document.getElementById("charCount");
  const dishBox       = document.getElementById("dishesBox");
  const dishEntry     = document.getElementById("dishEntry");
  const visitDateEl   = document.getElementById("visitDate");
  const uploadZone    = document.getElementById("uploadZone");
  const photoInput    = document.getElementById("photoInput");
  const photoPreviews = document.getElementById("photoPreviews");
  const submitBtn     = document.getElementById("submitBtn");
  const cancelBtn     = document.getElementById("cancelBtn");
  const flashMsg      = document.getElementById("flashMsg");

  /* ── read restaurant context from URL params (optional) ── */
  const params = new URLSearchParams(window.location.search);
  const restaurantId   = params.get("id")   || null;
  const restaurantName = params.get("name") || null;

  if (restaurantName) {
    const nameEl = document.getElementById("restaurantName");
    if (nameEl) nameEl.textContent = decodeURIComponent(restaurantName);
  }

  /* ── sentiment ── */
  sentimentBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      sentimentBtns.forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      selectedSentiment = btn.dataset.val;
    });
  });

  /* ── star rating ── */
  starBtns.forEach((btn) => {
    btn.addEventListener("mouseover", () => highlightStars(parseInt(btn.dataset.val)));
    btn.addEventListener("focus",     () => highlightStars(parseInt(btn.dataset.val)));
  });

  starsRow.addEventListener("mouseleave", () => highlightStars(selectedStars));
  starsRow.addEventListener("focusout",   (e) => {
    if (!starsRow.contains(e.relatedTarget)) highlightStars(selectedStars);
  });

  starBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = parseInt(btn.dataset.val);
      // clicking same star deselects
      selectedStars = (selectedStars === val) ? 0 : val;
      highlightStars(selectedStars);
      markSelectedStars();
    });
  });

  function highlightStars(upTo) {
    starBtns.forEach((b) => {
      const v = parseInt(b.dataset.val);
      b.classList.toggle("hovered", v <= upTo);
    });
  }

  function markSelectedStars() {
    starBtns.forEach((b) => {
      const v = parseInt(b.dataset.val);
      b.classList.toggle("selected", v <= selectedStars);
    });
  }

  /* ── character count ── */
  notesEl.addEventListener("input", () => {
    charCountEl.textContent = notesEl.value.length;
  });

  /* ── dishes tag input ── */
  function renderDishes() {
    document.querySelectorAll("#dishesBox .tag-chip").forEach((c) => c.remove());
    dishes.forEach((dish, idx) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML = `${dish}<button type="button" aria-label="Remove ${dish}">×</button>`;
      chip.querySelector("button").addEventListener("click", () => {
        dishes.splice(idx, 1);
        renderDishes();
      });
      dishBox.insertBefore(chip, dishEntry);
    });
  }

  function commitDish() {
    const raw = dishEntry.value.trim();
    if (!raw) return;
    raw.split(",")
       .map((s) => s.trim())
       .filter(Boolean)
       .forEach((d) => { if (!dishes.includes(d)) dishes.push(d); });
    dishEntry.value = "";
    renderDishes();
  }

  dishEntry.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commitDish(); }
    if (e.key === "Backspace" && dishEntry.value === "" && dishes.length > 0) {
      dishes.pop();
      renderDishes();
    }
  });

  dishBox.addEventListener("click", () => dishEntry.focus());

  /* ── photo upload ── */
  const MAX_PHOTOS   = 6;
  const MAX_BYTES    = 5 * 1024 * 1024; // 5 MB
  const selectedFiles = []; // array of File objects

  function renderPreviews() {
    photoPreviews.innerHTML = "";
    selectedFiles.forEach((file, idx) => {
      const url  = URL.createObjectURL(file);
      const item = document.createElement("div");
      item.className = "preview-item";
      item.innerHTML = `
        <img src="${url}" alt="Preview ${idx + 1}" />
        <button class="preview-remove" type="button" aria-label="Remove photo ${idx + 1}">×</button>
      `;
      item.querySelector(".preview-remove").addEventListener("click", () => {
        URL.revokeObjectURL(url);
        selectedFiles.splice(idx, 1);
        renderPreviews();
      });
      photoPreviews.appendChild(item);
    });

    // show count hint when photos selected
    const existing = photoPreviews.querySelector(".upload-count");
    if (existing) existing.remove();
    if (selectedFiles.length > 0) {
      const count = document.createElement("p");
      count.className = "upload-count";
      count.textContent = `${selectedFiles.length} / ${MAX_PHOTOS} photo${selectedFiles.length !== 1 ? "s" : ""} selected`;
      photoPreviews.appendChild(count);
    }
  }

  function addFiles(fileList) {
    const remaining = MAX_PHOTOS - selectedFiles.length;
    let skipped = 0;

    Array.from(fileList).slice(0, remaining).forEach((file) => {
      if (!file.type.startsWith("image/")) { skipped++; return; }
      if (file.size > MAX_BYTES)           { skipped++; return; }
      selectedFiles.push(file);
    });

    if (skipped > 0) showFlash(`${skipped} file(s) skipped — must be an image under 5 MB.`);
    else clearFlash();

    renderPreviews();

    // disable input if at max
    photoInput.disabled = selectedFiles.length >= MAX_PHOTOS;
  }

  photoInput.addEventListener("change", (e) => {
    addFiles(e.target.files);
    photoInput.value = ""; // reset so same file can be re-added after removal
  });

  // drag & drop
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("drag-over");
  });
  uploadZone.addEventListener("dragleave", () => uploadZone.classList.remove("drag-over"));
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("drag-over");
    addFiles(e.dataTransfer.files);
  });

  // keyboard accessibility
  uploadZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); photoInput.click(); }
  });

  /* ── flash helper ── */
  function showFlash(msg, type = "error") {
    flashMsg.textContent = msg;
    flashMsg.className   = `flash ${type}`;
    flashMsg.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function clearFlash() {
    flashMsg.textContent = "";
    flashMsg.className   = "flash";
  }

  /* ── cancel ── */
  cancelBtn.addEventListener("click", () => {
    window.location.href = restaurantId
      ? `restaurant.html?id=${restaurantId}`
      : "restaurant.html";
  });

  /* ── submit ── */
  submitBtn.addEventListener("click", async () => {
    clearFlash();

    // Commit any in-progress dish
    commitDish();

    // Validate: at minimum, sentiment OR stars must be set
    if (!selectedSentiment && selectedStars === 0) {
      showFlash("Please select how the visit was or give it a star rating.");
      return;
    }

    const token = localStorage.getItem("jwtToken");
    if (!token) {
      showFlash("You must be logged in to post a review.");
      setTimeout(() => (window.location.href = "/"), 1500);
      return;
    }

    const payload = {
      restaurantId:  restaurantId,
      sentiment:     selectedSentiment,
      stars:         selectedStars || null,
      notes:         notesEl.value.trim() || null,
      favoriteDishes: dishes.length ? dishes : null,
      visitDate:     visitDateEl.value || null,
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Posting…";

    try {
      // Build FormData so photos can be included
      const formData = new FormData();
      formData.append("data", JSON.stringify(payload));
      selectedFiles.forEach((file, i) => formData.append(`photos`, file));

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: {
          // No Content-Type header — browser sets it with boundary for FormData
          "Authorization": token,
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        showFlash(data.message || "Failed to post review.");
        submitBtn.disabled = false;
        submitBtn.textContent = "Post Review";
        return;
      }

      showFlash("Review posted!", "success");
      submitBtn.textContent = "Posted ✓";

      setTimeout(() => {
        window.location.href = restaurantId
          ? `restaurant.html?id=${restaurantId}`
          : "restaurant.html";
      }, 1200);

    } catch (err) {
      console.error(err);
      showFlash("Server connection error. Please try again.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Post Review";
    }

    

    
  });

})();



// fixing the broken name and back button on the review page when coming from the restaurant page
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const restaurantId = params.get("id");

  if (!restaurantId) return;

  try {
    const res = await fetch(`/api/restaurants/${restaurantId}`);
    const data = await res.json();

    if (!res.ok || !data.restaurant) return;

    // Set restaurant name
    const nameEl = document.getElementById("restaurantName");
    if (nameEl) {
      nameEl.textContent = data.restaurant.restaurantName || "Restaurant";
    }

    // Fix cancel button
    const cancelBtn = document.getElementById("cancelBtn");
    if (cancelBtn) {
      cancelBtn.onclick = function () {
        window.location.href = `restaurant.html?id=${restaurantId}`;
      };
    }

    // Fix back button
        const backBtn = document.getElementById("backBtn");
    if (backBtn) {
      backBtn.onclick = function () {
        window.location.href = `restaurant.html?id=${restaurantId}`;
      };
    }

  } catch (err) {
    console.error("Context load failed:", err);
  }
});